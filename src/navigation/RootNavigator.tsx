import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loadUser } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { RootStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { storage } from '../services/storage';
import { checkPermissions } from '../utils/permissions';
import socketService from '../services/socket';
import { View } from 'react-native';
import { ConnectionStatusIndicator } from '../components/ConnectionStatusIndicator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSplashReady, setIsSplashReady] = useState(false);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const initializationRef = useRef<boolean>(false);
  const mountedRef = useRef(true);
  const socketInitializedRef = useRef(false);
  const previousTokenRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (socketService.isConnected) {
        socketService.disconnect();
      }
    };
  }, []);

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
            } catch (error) {
              console.error('[RootNavigator] Failed to load user session:', error);
              // Clear token if validation fails
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

  const shouldShowAuth = !token || needsPermissions;
  
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