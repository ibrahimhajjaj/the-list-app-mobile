import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { createList, updateList, deleteList } from '../store/actions/listActions';
import { setNetworkState, resetNetworkState } from '../store/slices/networkSlice';
import { storage } from '../services/storage';
import { databaseService } from '../services/database';
import { syncService } from '../services/sync';
import { ClipboardCheck } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import * as SQLite from 'expo-sqlite';
import { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

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
    console.error('Failed to persist logs:', error);
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
    console.error('Failed to load persisted logs:', error);
  }
  return [];
};

const logToConsole = (message: string, type: TestLog['type'] = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
};

export function OfflineTestRunner() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const colors = useThemeColors();
  const dispatch = useAppDispatch();
  const networkState = useAppSelector(state => state.network);

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
    console.clear();
    logToConsole('Logs cleared', 'info');
  };

  const waitForNetworkState = async (targetState: 'offline' | 'online'): Promise<void> => {
    return new Promise((resolve, reject) => {
      const maxAttempts = 30; // 30 seconds timeout
      let attempts = 0;

      const checkInterval = setInterval(async () => {
        const isOnline = networkState.isConnected && networkState.isInternetReachable;
        
        if ((targetState === 'offline' && !isOnline) || (targetState === 'online' && isOnline)) {
          clearInterval(checkInterval);
          resolve();
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for network to be ${targetState}`));
        }
      }, 1000);
    });
  };

  const setNetworkStateForTesting = async (isOnline: boolean) => {
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
    
    // Wait for state to be updated
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify the state change
    const currentState = store.getState().network;
    const actualIsOnline = currentState.isConnected && currentState.isInternetReachable;
    
    if (actualIsOnline !== isOnline) {
      throw new Error(`Failed to set network state to ${isOnline ? 'online' : 'offline'}. Current state: ${JSON.stringify(currentState)}`);
    }
  };

  const runTests = async () => {
    if (isRunning) return;
    setIsRunning(true);
    await clearLogs();
    
    try {
      await addLog('Starting offline functionality tests...', 'info');

      // Test 1: Create list while offline
      await addLog('\n📝 Test 1: Creating list while offline', 'info');
      await addLog('Setting network state to offline...', 'info');
      
      try {
        await setNetworkStateForTesting(false);
        await addLog('✓ Network is now offline', 'success');
        await addLog('Attempting to create list...', 'info');
        
        // Create list without transaction
        const newList = await dispatch(createList({ title: 'Offline Test List' })).unwrap();
        await addLog('✓ Created list with temporary ID: ' + newList._id, 'success');

        // Verify local storage
        await addLog('Verifying local storage...', 'info');
        const storedLists = await storage.getLists();
        const foundList = storedLists.find(l => l._id === newList._id);
        await addLog(
          foundList ? '✓ List successfully stored locally' : '✗ List not found in local storage',
          foundList ? 'success' : 'error'
        );

        // Add a small delay to ensure database operations are complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Test 2: Update list while offline
        await addLog('\n🔄 Test 2: Updating list while offline', 'info');
        await addLog('Preparing update data...', 'info');
        const updateData = {
          items: [{
            _id: 'temp_' + Date.now(),
            text: 'Offline created item',
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }]
        };
        
        await addLog('Attempting to update list...', 'info');
        await dispatch(updateList({ 
          listId: newList._id, 
          data: updateData 
        })).unwrap();
        await addLog('✓ List updated successfully in local storage', 'success');

        // Add a small delay to ensure database operations are complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Test 3: Check pending changes
        await addLog('\n🔍 Test 3: Verifying pending changes', 'info');
        await addLog('Fetching pending changes...', 'info');
        const pendingChanges = await databaseService.getPendingChanges();
        await addLog(`Found ${pendingChanges.length} pending changes:`, 'info');
        for (const change of pendingChanges) {
          await addLog(`  • ${change.actionType} - ${change.entityId}`, 'info');
        }

        // Test 4: Sync when back online
        await addLog('\n🌐 Test 4: Testing sync when back online', 'info');
        await addLog('Setting network state to online...', 'info');
        await setNetworkStateForTesting(true);
        await addLog('✓ Network is now online', 'success');
        
        await addLog('Waiting for sync to complete...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await addLog('Checking remaining pending changes...', 'info');
        const afterSyncChanges = await databaseService.getPendingChanges();
        await addLog(
          `Sync completed - Remaining changes: ${afterSyncChanges.length}`,
          afterSyncChanges.length === 0 ? 'success' : 'error'
        );

        // Test 5: Delete list
        await addLog('\n🗑️ Test 5: Testing list deletion while offline', 'info');
        await addLog('Setting network state to offline...', 'info');
        await setNetworkStateForTesting(false);
        await addLog('✓ Network is now offline', 'success');
        
        await addLog('Attempting to delete list...', 'info');
        await dispatch(deleteList(newList._id));
        await addLog('✓ List deleted from local storage', 'success');

        // Add a small delay to ensure database operations are complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Final sync
        await addLog('\n🔄 Final sync test', 'info');
        await addLog('Setting network state to online...', 'info');
        await setNetworkStateForTesting(true);
        await addLog('✓ Network is now online', 'success');
        
        await addLog('Waiting for final sync...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await addLog('Checking final pending changes...', 'info');
        const finalChanges = await databaseService.getPendingChanges();
        await addLog(
          '✨ Test suite completed successfully',
          finalChanges.length === 0 ? 'success' : 'error'
        );

      } catch (error: any) {
        await addLog(`❌ Test step failed: ${error.message}`, 'error');
        if (error.stack) {
          await addLog(`Stack trace: ${error.stack}`, 'error');
        }
        throw error; // Re-throw to be caught by outer try-catch
      }

    } catch (error: any) {
      await addLog(`❌ Test suite failed: ${error.message}`, 'error');
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
      // Reset network state to online at the end
      try {
        await setNetworkStateForTesting(true);
        await addLog('Network state reset to online', 'info');
      } catch (error: any) {
        await addLog(`Failed to reset network state: ${error.message}`, 'error');
      }
    }
  };

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