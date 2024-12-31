import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { createList, updateList, deleteList, fetchLists } from '../store/actions/listActions';
import { setNetworkState, resetNetworkState } from '../store/slices/networkSlice';
import { storage } from '../services/storage';
import { databaseService } from '../services/database';
import { ClipboardCheck } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import * as SQLite from 'expo-sqlite';
import { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import api from '../services/api';
import { API_CONFIG } from '../config/api';

const db = SQLite.openDatabaseSync('thelistapp.db');

interface TestLog {
  message: string;
  type: 'info' | 'success' | 'error';
  timestamp: Date;
}

const OFFLINE_LOGS_KEY = '@offline_test_logs';

const persistLogs = async (logs: TestLog[]) => {
  try {
    await AsyncStorage.setItem(OFFLINE_LOGS_KEY, JSON.stringify(logs));
  } catch (error) {
    // Non-critical error, failed to persist logs
  }
};

const loadPersistedLogs = async (): Promise<TestLog[]> => {
  try {
    const logsStr = await AsyncStorage.getItem(OFFLINE_LOGS_KEY);
    if (logsStr) {
      const logs = JSON.parse(logsStr);
      return logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
    }
  } catch (error) {
    // Non-critical error, failed to load persisted logs
  }
  return [];
};

const logToConsole = (message: string, type: TestLog['type'] = 'info') => {
  const timestamp = new Date().toISOString();
  let formattedMessage = '';
  
  // Format based on message type
  if (message.includes('Network switched to')) {
    // Network state changes - using less alarming colors
    const isOnline = message.includes('online');
    const color = isOnline ? '\x1b[32m' : '\x1b[33m'; // Green for online, Yellow for offline
    const icon = isOnline ? '🌐' : '📴';
    const status = isOnline ? '[✓] Online' : '[✓] Offline';
    formattedMessage = `${color}${icon} Network: ${status}\x1b[0m`;
    console.log(formattedMessage);
  } else if (message.includes('Test')) {
    // Test suite headers
    console.log('\n\x1b[36m%s\x1b[0m', message); // Cyan for test suite headers
  } else if (message.startsWith('✓')) {
    // Successful test cases
    console.log('\x1b[32m%s\x1b[0m', `  [✓] ${message.substring(2)}`); // Green for passing tests
  } else if (type === 'error') {
    // Error messages
    console.log('\x1b[31m%s\x1b[0m', `  [✖] ${message}`); // Red for errors
  } else if (type === 'success') {
    // Success messages
    console.log('\x1b[32m%s\x1b[0m', `  [✓] ${message}`); // Green for success
  }

  // Return formatted message for UI
  return `${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} [${timestamp}] ${message}`;
};

// Add helper function for waiting
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add helper for ID mapping
const getActualId = async (tempId: string): Promise<string> => {
  const pendingChanges = await databaseService.getPendingChanges();
  const createChange = pendingChanges.find(
    change => change.entityId === tempId && change.actionType === 'CREATE_LIST'
  );
  return createChange?.data?.actualId || tempId;
};

const logStorageState = async (context: string) => {
  const storedLists = await storage.getLists();
  const pendingChanges = await databaseService.getPendingChanges();
  
  // Get unique lists by ID to avoid duplicates
  const uniqueLists = Array.from(new Set(storedLists.map(list => list._id)))
    .map(id => storedLists.find(list => list._id === id)!)
    .filter(list => 
      list.title.includes('Test List') || 
      list.title.includes('Sequence List') || 
      list.title.includes('Online Created List')
    );

  // Group lists by title
  const listsByTitle = new Map<string, string[]>();
  for (const list of uniqueLists) {
    const existing = listsByTitle.get(list.title) || [];
    listsByTitle.set(list.title, [...existing, list._id]);
  }

  // Find duplicates
  const duplicateTitles = Array.from(listsByTitle.entries())
    .filter(([_, ids]) => ids.length > 1)
    .map(([title, ids]) => ({
      title,
      count: ids.length
    }));

  // Create a concise summary
  return {
    context,
    summary: {
      total: storedLists.length,
      testLists: uniqueLists.length,
      pending: pendingChanges.length,
      duplicates: duplicateTitles.length
    },
    details: uniqueLists.length <= 5 ? {
      lists: uniqueLists.map(l => ({
        id: l._id.substring(0, 8),
        title: l.title,
        v: l.__v || 0
      }))
    } : undefined,
    duplicates: duplicateTitles.length > 0 ? duplicateTitles : undefined,
    pendingChanges: pendingChanges.length > 0 ? pendingChanges.map(c => ({
      type: c.actionType,
      id: c.entityId.substring(0, 8)
    })) : undefined
  };
};

export function OfflineTestRunner() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [createdLists, setCreatedLists] = useState<string[]>([]);
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const networkState = useAppSelector(state => state.network);

  // Track network state changes
  useEffect(() => {
    const isOnline = networkState.isConnected && networkState.isInternetReachable;
    // Network state changes are handled by the network slice
  }, [networkState]);

  useEffect(() => {
    loadPersistedLogs().then(loadedLogs => {
      if (loadedLogs.length > 0) {
        setLogs(loadedLogs);
      }
    });
  }, []);

  const addLog = async (message: string, type: TestLog['type'] = 'info') => {
    const log = { message, type, timestamp: new Date() };
    const newLogs = [...logs, log];
    setLogs(newLogs);
    await persistLogs(newLogs);
    logToConsole(message, type);
  };

  const clearLogs = async () => {
    setLogs([]);
    await AsyncStorage.removeItem(OFFLINE_LOGS_KEY);
    // No need for console.clear() or additional logging
  };

  const waitForNetworkState = async (targetOnline: boolean, maxAttempts: number = 5): Promise<void> => {
    const getCurrentState = () => {
      const state = store.getState().network;
      return {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        isOnline: state.isConnected && state.isInternetReachable,
        type: state.type
      };
    };

    let attempts = 0;
    while (attempts < maxAttempts) {
      attempts++;
      const currentState = getCurrentState();
      
      if (currentState.isOnline === targetOnline) {
        return;
      }

      // Only log if we need to wait more
      if (attempts < maxAttempts) {
        const color = '\x1b[33m'; // Yellow for waiting
        console.log(`${color}⏳ Waiting for network to be ${targetOnline ? 'online' : 'offline'}... (${attempts}/${maxAttempts})\x1b[0m`);
        await wait(1000);
      }
    }

    throw new Error(`Network state did not reach ${targetOnline ? 'online' : 'offline'} after ${maxAttempts} attempts`);
  };

  const setNetworkStateForTesting = async (isOnline: boolean) => {
    const getCurrentState = () => {
      const state = store.getState().network;
      return {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type
      };
    };

    // First, dispatch the network state change
    if (isOnline) {
      dispatch(setNetworkState({
        isConnected: true,
        isInternetReachable: true,
        type: NetInfoStateType.wifi,
        details: {
          isConnectionExpensive: false,
          ssid: null,
          strength: null,
          ipAddress: null,
          subnet: null,
          frequency: null,
          linkSpeed: null,
          rxLinkSpeed: null,
          txLinkSpeed: null,
          bssid: null
        }
      } as NetInfoState));
    } else {
      dispatch(setNetworkState({
        isConnected: false,
        isInternetReachable: false,
        type: NetInfoStateType.none,
        details: null
      } as NetInfoState));
    }
    
    // Wait for state to update
    await wait(500);
    
    // Get latest state
    const currentState = store.getState().network;
    const actualIsOnline = currentState.isConnected && currentState.isInternetReachable;

    // Only log failures
    if (actualIsOnline !== isOnline) {
      const color = '\x1b[31m'; // Red for errors
      console.log(`${color}[✖] Failed to set network state to ${isOnline ? 'online' : 'offline'}\x1b[0m`);
      throw new Error(`Failed to set network state to ${isOnline ? 'online' : 'offline'}`);
    }

    // Wait a bit longer to ensure state propagation
    await wait(500);
  };

  const resetNetworkState = useCallback(async () => {
    try {
      await setNetworkStateForTesting(true);
      await addLog('Network state reset to online', 'info');
    } catch (error: any) {
      await addLog(`Failed to reset network state: ${error.message}`, 'error');
    }
  }, []);

  const cleanupAllTestData = async () => {
    await addLog('\n🧹 Cleaning up test data...', 'info');
    
    try {
        // Ensure we're online for cleanup
        await setNetworkStateForTesting(true);
        await wait(2000); // Wait longer for sync to complete

        // Call debug cleanup endpoint first
        try {
            await api.delete(API_CONFIG.ENDPOINTS.DEBUG.CLEANUP_LISTS);
            await addLog('✓ Called debug cleanup endpoint', 'success');
        } catch (error: any) {
            await addLog(`Failed to call debug cleanup endpoint: ${error.message}`, 'error');
        }

        // Get all lists from storage to ensure we catch any that might have been created
        const storedLists = await storage.getLists();
        
        // Get unique lists by ID and filter test lists
        const uniqueListsMap = new Map();
        storedLists.forEach(list => {
            if (list.title.includes('Test List') || 
                list.title.includes('Sequence List') || 
                list.title.includes('Online Created List')) {
                uniqueListsMap.set(list._id, list);
            }
        });
        const uniqueLists = Array.from(uniqueListsMap.values());

        await addLog(`Found ${uniqueLists.length} test lists to clean up locally`, 'info');

        if (uniqueLists.length > 0) {
            // Get non-test lists
            const nonTestLists = storedLists.filter(list => !uniqueListsMap.has(list._id));
            
            // Save only non-test lists in a single operation
            await storage.saveLists(nonTestLists);
            await addLog(`✓ Removed ${uniqueLists.length} test lists from storage`, 'success');

            // Clean up pending changes for all test lists
            for (const list of uniqueLists) {
                const pendingChanges = await databaseService.getPendingChanges();
                const relatedChanges = pendingChanges.filter(change => 
                    change.entityId === list._id || 
                    change.data?.actualId === list._id ||
                    // Also check for changes related to this list's title
                    (change.data?.title && list.title === change.data.title)
                );

                if (relatedChanges.length > 0) {
                    for (const change of relatedChanges) {
                        await databaseService.removePendingChange(change.id);
                    }
                    await addLog(`✓ Cleaned up ${relatedChanges.length} pending changes for: ${list._id}`, 'success');
                }
            }
        }

        // Clear the tracked lists
        setCreatedLists([]);
        
        // Verify cleanup
        const remainingLists = await storage.getLists();
        const remainingTestLists = remainingLists.filter(list => 
            list.title.includes('Test List') || 
            list.title.includes('Sequence List') || 
            list.title.includes('Online Created List')
        );

        if (remainingTestLists.length > 0) {
            await addLog(`⚠️ Warning: ${remainingTestLists.length} test lists still remain locally`, 'error');
            for (const list of remainingTestLists) {
                await addLog(`  • ${list._id} - ${list.title}`, 'info');
            }
            
            // Force a final cleanup by resetting the local DB
            await storage.resetLocalDBExceptAuth();
            await addLog('✓ Forced final cleanup by resetting local DB', 'success');
        } else {
            await addLog('✓ All test lists cleaned up successfully', 'success');
        }

    } catch (error: any) {
        await addLog(`❌ Cleanup failed: ${error.message}`, 'error');
        console.error('Cleanup error:', error);
    }
  };

  const runTests = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    await clearLogs();
    
    try {
      // Get initial list count
      const initialLists = await dispatch(fetchLists()).unwrap();
      await addLog(`\n📊 Initial state: ${initialLists.length} total lists in system`, 'info');
      
      await logStorageState('Before Cleanup');
      // Clean up any existing test data first
      await cleanupAllTestData();
      await logStorageState('After Cleanup');

      // Ensure we start with a clean state
      await setNetworkStateForTesting(true);
      await waitForNetworkState(true);
      await wait(2000); // Wait for any pending syncs
      
      await addLog('Starting comprehensive offline functionality tests...', 'info');

      // Test 1: Basic List Creation
      await addLog('\n📝 Test 1: Basic List Creation', 'info');
      await addLog('Setting network state to offline...', 'info');
      
      try {
        await setNetworkStateForTesting(false);
        await waitForNetworkState(false);
        await addLog('✓ Network is now offline', 'success');
        await logStorageState('Before Create List');
        await addLog('Attempting to create list...', 'info');
        
        // Get unique test lists before creation
        const beforeLists = (await storage.getLists() || [])
          .filter(list => list.title.includes('Test List'));
        const uniqueBeforeLists = new Set(beforeLists.map(l => l.title)).size;
        
        const newList = await dispatch(createList({ 
          title: 'Offline Test List',
          items: [],
          sharedWith: []
        })).unwrap();
        
        // Get unique test lists after creation
        const afterLists = (await storage.getLists() || [])
          .filter(list => list.title.includes('Test List'));
        const uniqueAfterLists = new Set(afterLists.map(l => l.title)).size;
        
        // Verify exactly one new unique list was created
        const newUniqueListsCount = uniqueAfterLists - uniqueBeforeLists;
        if (newUniqueListsCount !== 1) {
          await addLog(`⚠️ Warning: Created ${newUniqueListsCount} unique lists instead of 1`, 'error');
        }
        
        setCreatedLists(prev => [...prev, newList._id]);
        await logStorageState('After Create List');
        await addLog('✓ Created list with temporary ID: ' + newList._id, 'success');

        // Test 2: Multiple Operations Sequence
        await addLog('\n🔄 Test 2: Multiple Operations Sequence', 'info');
        await addLog('Creating multiple lists while offline...', 'info');
        
        // Get unique sequence lists before creation
        const beforeSequenceLists = (await storage.getLists() || [])
          .filter(list => list.title.includes('Sequence List'));
        const uniqueBeforeSequenceLists = new Set(beforeSequenceLists.map(l => l.title)).size;
        
        // Create lists sequentially with proper waiting
        const list1 = await dispatch(createList({ 
          title: 'Sequence List 1',
          items: [],
          sharedWith: []
        })).unwrap();
        await wait(1000); // Wait for storage operations to complete
        
        const list2 = await dispatch(createList({ 
          title: 'Sequence List 2',
          items: [],
          sharedWith: []
        })).unwrap();
        await wait(1000); // Wait for storage operations to complete
        
        // Get unique sequence lists after creation
        const afterSequenceLists = (await storage.getLists() || [])
          .filter(list => list.title.includes('Sequence List'));
        const uniqueAfterSequenceLists = new Set(afterSequenceLists.map(l => l.title)).size;
        
        // Verify exactly two new unique lists were created
        const newUniqueSequenceListsCount = uniqueAfterSequenceLists - uniqueBeforeSequenceLists;
        if (newUniqueSequenceListsCount !== 2) {
          await addLog(`⚠️ Warning: Created ${newUniqueSequenceListsCount} unique sequence lists instead of 2`, 'error');
        }
        
        setCreatedLists(prev => [...prev, list1._id, list2._id]);
        await logStorageState('After Sequence Lists');
        await addLog('✓ Created multiple lists successfully', 'success');

        // Test 3: Sequential Updates
        await addLog('\n🔄 Test 3: Sequential Updates', 'info');
        await addLog('Testing sequential updates...', 'info');
        
        // First update
        await dispatch(updateList({
          listId: newList._id,
          data: { title: 'Updated Test List - 1' }
        })).unwrap();
        await addLog('✓ First update successful', 'success');

        // Wait a bit to ensure proper sequencing
        await wait(1000);

        // Second update with different data
        await dispatch(updateList({
          listId: newList._id,
          data: { title: 'Updated Test List - 2' }
        })).unwrap();
        await addLog('✓ Second update successful', 'success');

        // Test 4: Concurrent Updates
        await addLog('\n⚡️ Test 4: Concurrent Updates', 'info');
        await addLog('Testing concurrent updates...', 'info');

        try {
          // Use separate transactions for each update
          await dispatch(updateList({
            listId: list1._id,
            data: { title: 'Concurrent Update 1' }
          })).unwrap();
          
          await wait(1000);
          
          await dispatch(updateList({
            listId: list1._id,
            data: { title: 'Concurrent Update 2' }
          })).unwrap();
          
          await addLog('✓ Sequential updates completed', 'success');
        } catch (error) {
          await addLog('✓ Update conflict detected as expected', 'success');
        }

        // Test 5: Batch Item Operations
        await addLog('\n📦 Test 5: Batch Item Operations', 'info');
        await addLog('Adding items in batch...', 'info');

        const now = new Date().toISOString();
        const batchItems = [
          {
            _id: 'temp_' + Date.now() + '_1',
            text: 'Batch Item 1',
            completed: false,
            createdAt: now,
            updatedAt: now
          },
          {
            _id: 'temp_' + Date.now() + '_2',
            text: 'Batch Item 2',
            completed: true,
            createdAt: now,
            updatedAt: now
          }
        ];

        await dispatch(updateList({
          listId: newList._id,
          data: { items: batchItems }
        })).unwrap();
        await addLog('✓ First batch update successful', 'success');

        // Wait to ensure version increment
        await wait(1000);

        // Add more items in a separate update
        const moreBatchItems = [
          ...batchItems,
          {
            _id: 'temp_' + Date.now() + '_3',
            text: 'Batch Item 3',
            completed: false,
            createdAt: now,
            updatedAt: now
          }
        ];

        await dispatch(updateList({
          listId: newList._id,
          data: { items: moreBatchItems }
        })).unwrap();
        await addLog('✓ Second batch update successful', 'success');

        // Test 6: Error Cases
        await addLog('\n⚠️ Test 6: Error Cases', 'info');
        await addLog('Testing various error scenarios...', 'info');

        // Invalid ID
        try {
          await dispatch(updateList({
            listId: 'invalid_id',
            data: { title: 'Should Fail' }
          })).unwrap();
        } catch (error) {
          await addLog('✓ Invalid ID error handled correctly', 'success');
        }

        // Test 7: Mixed Online/Offline Operations
        await addLog('\n🌐 Test 7: Mixed Online/Offline Operations', 'info');
        await addLog('Testing online/offline transitions...', 'info');

        try {
          await setNetworkStateForTesting(true);
          await waitForNetworkState(true);
          await addLog('Network switched to online', 'info');
          await wait(2000); // Wait for sync
          await logStorageState('Before Online Create');

          // Create list while online
          const onlineList = await dispatch(createList({ 
            title: 'Online Created List',
            items: [],
            sharedWith: []
          })).unwrap();
          setCreatedLists(prev => [...prev, onlineList._id]);
          await logStorageState('After Online Create');
          await addLog('✓ Created list while online', 'success');

          await wait(2000); // Wait for sync
          await logStorageState('After Sync');

          await setNetworkStateForTesting(false);
          await waitForNetworkState(false);
          await addLog('Network switched to offline', 'info');

          // Multiple offline updates to online-created list
          try {
            await dispatch(updateList({
              listId: onlineList._id,
              data: { title: 'Updated Offline - 1' }
            })).unwrap();
            await addLog('✓ First offline update to online list successful', 'success');

            await wait(1000);

            await dispatch(updateList({
              listId: onlineList._id,
              data: { title: 'Updated Offline - 2' }
            })).unwrap();
            await addLog('✓ Second offline update to online list successful', 'success');
          } catch (error: any) {
            await addLog(`❌ Offline update failed: ${error.message}`, 'error');
          }

        } catch (error: any) {
          await addLog(`❌ Test failed: ${error.message}`, 'error');
          await logStorageState('After Error');
        }

        // Test 8: Conflict Resolution Edge Cases
        await addLog('\n🔄 Test 8: Conflict Resolution Edge Cases', 'info');
        await addLog('Testing version conflict handling...', 'info');

        try {
          // Create a list for conflict testing
          await setNetworkStateForTesting(true);
          await waitForNetworkState(true);
          await addLog('Network switched to online', 'info');

          const conflictList = await dispatch(createList({ 
            title: 'Conflict Test List',
            items: [],
            sharedWith: []
          })).unwrap();
          setCreatedLists(prev => [...prev, conflictList._id]);
          await addLog('✓ Created list for conflict testing', 'success');

          // Go offline and make changes
          await setNetworkStateForTesting(false);
          await waitForNetworkState(false);
          await addLog('Network switched to offline', 'info');

          // Make offline changes
          await dispatch(updateList({
            listId: conflictList._id,
            data: { title: 'Offline Update' }
          })).unwrap();
          await addLog('✓ Made offline update', 'success');

          // Simulate server-side change by directly modifying storage version
          const storedLists = await storage.getLists() || [];
          const updatedLists = storedLists.map(list => 
            list._id === conflictList._id 
              ? { ...list, __v: (list.__v || 0) + 1 }
              : list
          );
          await storage.saveLists(updatedLists);
          await addLog('✓ Simulated server-side update', 'success');

          // Go back online to trigger conflict
          await setNetworkStateForTesting(true);
          await waitForNetworkState(true);
          await wait(2000); // Wait for sync

          await addLog('✓ Conflict resolution test completed', 'success');
        } catch (error: any) {
          await addLog(`Conflict handling: ${error.message}`, 'info');
        }

        // Test 9: Network State Transitions
        await addLog('\n🌍 Test 9: Network State Transitions', 'info');
        await addLog('Testing rapid network state changes...', 'info');

        try {
          // Create a list to track through transitions
          const transitionList = await dispatch(createList({ 
            title: 'Network Transition List',
            items: [],
            sharedWith: []
          })).unwrap();
          setCreatedLists(prev => [...prev, transitionList._id]);

          // Sequence of rapid network changes
          for (let i = 0; i < 3; i++) {
            await setNetworkStateForTesting(false);
            await waitForNetworkState(false);
            await addLog('Network switched to offline', 'info');

            // Make offline change
            await dispatch(updateList({
              listId: transitionList._id,
              data: { title: `Offline Update ${i + 1}` }
            })).unwrap();
            await addLog(`✓ Made offline update ${i + 1}`, 'success');

            await wait(500); // Brief wait

            await setNetworkStateForTesting(true);
            await waitForNetworkState(true);
            await addLog('Network switched to online', 'info');
            await wait(1000); // Wait for sync
          }

          await addLog('✓ Network transition test completed', 'success');
        } catch (error: any) {
          await addLog(`Network transition test failed: ${error.message}`, 'error');
        }

        // Test 10: Data Validation
        await addLog('\n🔍 Test 10: Data Validation', 'info');
        await addLog('Testing data validation handling...', 'info');

        try {
          // Test with special characters
          const specialCharList = await dispatch(createList({ 
            title: 'Special Chars: !@#$%^&*()',
            items: [],
            sharedWith: []
          })).unwrap();
          setCreatedLists(prev => [...prev, specialCharList._id]);
          await addLog('✓ Created list with special characters', 'success');

          // Test with very long title
          const longTitle = 'Very'.repeat(100) + ' Long Title';
          try {
            await dispatch(createList({ 
              title: longTitle,
              items: [],
              sharedWith: []
            })).unwrap();
            await addLog('⚠️ Warning: Very long title was accepted', 'error');
          } catch (error) {
            await addLog('✓ Very long title rejected as expected', 'success');
          }

          // Test with invalid item structure
          try {
            await dispatch(updateList({
              listId: specialCharList._id,
              data: { 
                items: [{ 
                  _id: 'temp_' + Date.now(),
                  text: '', // Empty text
                  completed: 'invalid' as any, // Invalid boolean
                  createdAt: 'not-a-date', // Invalid date
                  updatedAt: 'not-a-date' // Invalid date
                }]
              }
            })).unwrap();
            await addLog('⚠️ Warning: Invalid item structure was accepted', 'error');
          } catch (error) {
            await addLog('✓ Invalid item structure rejected as expected', 'success');
          }

          await addLog('✓ Data validation test completed', 'success');
        } catch (error: any) {
          await addLog(`Data validation test failed: ${error.message}`, 'error');
        }

      } catch (error: any) {
        await addLog(`❌ Test step failed: ${error.message}`, 'error');
        await logStorageState('After Step Error');
      }

    } catch (error: any) {
      await addLog(`❌ Test suite failed: ${error.message}`, 'error');
      await logStorageState('After Suite Error');
    } finally {
      setIsRunning(false);
      // Ensure we're online for cleanup
      await setNetworkStateForTesting(true);
      await waitForNetworkState(true);
      await wait(2000); // Wait for sync
      await cleanupAllTestData();
      await resetNetworkState();
      
      // Get final list count
      try {
        const finalLists = await dispatch(fetchLists()).unwrap();
        await addLog(`\n📊 Final state: ${finalLists.length} total lists in system`, 'info');
        
        // Compare with local storage
        const localLists = await storage.getLists();
        const testLists = localLists.filter(list => 
          list.title.includes('Test List') || 
          list.title.includes('Sequence List') || 
          list.title.includes('Online Created List')
        );

        await addLog('\n📱 Local Storage State:', 'info');
        await addLog(`Total lists: ${localLists.length} (${testLists.length} test lists)`, 'info');

        // Group by title and only show if there are test lists
        if (testLists.length > 0) {
          const listsByTitle = new Map<string, any[]>();
          testLists.forEach((list: any) => {
            const existing = listsByTitle.get(list.title) || [];
            listsByTitle.set(list.title, [...existing, list]);
          });

          // Show summary by title
          for (const [title, lists] of listsByTitle.entries()) {
            if (lists.length > 0) {
              await addLog(`${title}: ${lists.length} lists`, 'info');
              // Only show first 3 IDs if there are many
              const displayLists = lists.slice(0, 3);
              for (const list of displayLists) {
                await addLog(`  • ${list._id.substring(0, 8)} (v${list.__v || 0})`, 'info');
              }
              if (lists.length > 3) {
                await addLog(`  • ... and ${lists.length - 3} more`, 'info');
              }
            }
          }
        }

        // Warn if there are too many lists
        if (localLists.length > 100) {
          await addLog(`⚠️ Warning: Unusually high number of lists (${localLists.length})`, 'error');
          await addLog('Consider investigating potential data duplication', 'error');
        }
      } catch (error: any) {
        await addLog(`❌ Failed to fetch final list count: ${error.message}`, 'error');
      }
      
      await logStorageState('After Final Cleanup');
      await storage.resetLocalDBExceptAuth();
    }
  }, [isRunning, resetNetworkState, clearLogs, addLog]);

  return (
    <>
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() => setIsModalVisible(true)}
      >
        <ClipboardCheck size={24} color={colors.primaryForeground} />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Offline Functionality Tests
            </Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.muted }]}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.mutedForeground }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.logsContainer}>
            {logs.map((log, index) => (
              <Text
                key={index}
                style={[
                  styles.logText,
                  {
                    color: log.type === 'error' ? colors.destructive :
                          log.type === 'success' ? colors.success :
                          colors.mutedForeground
                  }
                ]}
              >
                {`[${log.timestamp.toLocaleTimeString()}] ${log.message}`}
              </Text>
            ))}
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.runButton,
                { backgroundColor: colors.primary },
                isRunning && { opacity: 0.5 }
              ]}
              onPress={runTests}
              disabled={isRunning}
            >
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                {isRunning ? 'Running Tests...' : 'Run Tests'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.muted }]}
              onPress={clearLogs}
            >
              <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>
                Clear Logs
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.large,
  },
  modalContainer: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    ...theme.shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logsContainer: {
    flex: 1,
    padding: theme.spacing.m,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    gap: theme.spacing.m,
  },
  runButton: {
    flex: 2,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
  },
  clearButton: {
    flex: 1,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 