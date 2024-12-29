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
  const previousTokenRef = useRef<string | null>(null);

  useEffect(() => {
    // Initialize network monitoring
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
        const permissionsStatus = await checkPermissions();
        const permissionsNeeded = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
        
        if (!mountedRef.current) return;

        setNeedsPermissions(permissionsNeeded);

        if (!permissionsNeeded) {
          const storedToken = await storage.getAuthToken();
          
          if (storedToken) {
            try {
              await dispatch(loadUser()).unwrap();
              // Start sync service after successful auth
              syncService.startPeriodicSync(30000);
            } catch (error) {
              console.error('[RootNavigator] Failed to load user session:', error);
              await storage.saveAuthToken(null);
            }
          }
        }
      } catch (error: any) {
        if (mountedRef.current) {
          console.error('[RootNavigator] Initialization error:', error);
        }
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
      previousTokenRef.current = token;

      if (token && user && !isInitializing) {
        if (!socketService.isConnected && !socketInitializedRef.current) {
          socketInitializedRef.current = true;
          await socketService.connect(token);
        }
      } else if (!token && socketService.isConnected) {
        socketInitializedRef.current = false;
        socketService.disconnect();
        syncService.stopPeriodicSync();
      } else if (!user && token) {
        console.log('[RootNavigator] Waiting for user data before connecting socket');
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

  const shouldShowAuth = !isAuthenticated || needsPermissions;
  
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