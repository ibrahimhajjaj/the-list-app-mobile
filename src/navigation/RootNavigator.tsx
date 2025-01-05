import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loadUser } from '../store/slices/authSlice';
import { initializeNetworkMonitoring } from '../store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { RootStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { storage } from '../services/storage';
import { checkPermissions } from '../utils/permissions';
import socketService from '../services/socket';
import syncService from '../services/sync';
import { View } from 'react-native';
import { ConnectionStatusIndicator } from '../components/ConnectionStatusIndicator';
import { store } from '../store';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { token, user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSplashReady, setIsSplashReady] = useState(false);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const initializationRef = useRef<boolean>(false);
  const mountedRef = useRef(true);
  const socketInitializedRef = useRef(false);

  useEffect(() => {
    dispatch(initializeNetworkMonitoring());

    return () => {
      mountedRef.current = false;
      if (socketService.isConnected) {
        socketService.disconnect();
      }
      syncService.stopPeriodicSync();
    };
  }, [dispatch]);

  useEffect(() => {
    async function initializeApp() {
      if (!mountedRef.current || initializationRef.current) {
        return;
      }
      
      initializationRef.current = true;
      try {
        // Check permissions
        const permissionsStatus = await checkPermissions();
        const permissionsNeeded = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
        setNeedsPermissions(permissionsNeeded);

        if (!mountedRef.current) return;

        // Load stored token regardless of permissions
        const storedToken = await storage.getAuthToken();
        
        if (storedToken) {
          try {
            await dispatch(loadUser()).unwrap();
            syncService.startPeriodicSync(30000);
          } catch (error) {
            console.error('[RootNavigator] Failed to load user:', error);
            await storage.saveAuthToken(null);
          }
        }
      } catch (error: any) {
        console.error('[RootNavigator] Initialization error:', error);
      } finally {
        if (mountedRef.current) {
          setIsInitializing(false);
        }
      }
    }

    initializeApp();
  }, [dispatch]);

  useEffect(() => {
    const handleSocketConnection = async () => {
      // Skip if already initialized or still initializing
      if (socketInitializedRef.current || isInitializing) {
        return;
      }

      // Clear initialization flag when token is removed
      if (!token) {
        socketInitializedRef.current = false;
        if (socketService.isConnected) {
          socketService.disconnect();
          syncService.stopPeriodicSync();
        }
        return;
      }

      // Only proceed if we have all required conditions
      if (token && user && !isInitializing) {
        const networkState = store.getState().network;
        const isNetworkAvailable = networkState.isConnected && networkState.isInternetReachable;

        if (isNetworkAvailable) {
          socketInitializedRef.current = true;
          await socketService.connect(token);
        }
      }
    };

    handleSocketConnection();
  }, [token, user, isInitializing]);

  const handleSplashComplete = useCallback(() => {
    if (mountedRef.current) {
      setIsSplashReady(true);
    }
  }, []);

  if (isInitializing || !isSplashReady) {
    return <SplashScreen onReady={handleSplashComplete} />;
  }

  // Only show auth if not authenticated, permissions shouldn't block access
  const shouldShowAuth = !isAuthenticated;
  
  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {shouldShowAuth ? (
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{ animationTypeForReplace: 'pop' }}
            initialParams={{ needsPermissions }}
          />
        ) : (
          <Stack.Screen 
            name="Main" 
            component={MainNavigator}
            options={{ animationTypeForReplace: 'push' }}
          />
        )}
      </Stack.Navigator>
      {!shouldShowAuth && <ConnectionStatusIndicator />}
    </View>
  );
} 