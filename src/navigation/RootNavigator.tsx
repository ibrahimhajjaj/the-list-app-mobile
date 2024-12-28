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
import { Platform } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((state) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSplashReady, setIsSplashReady] = useState(false);
  const [needsPermissions, setNeedsPermissions] = useState(false);
  const initializationRef = useRef<boolean>(false);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function initializeApp() {
      // Ensure initialization only runs once
      if (!mountedRef.current || initializationRef.current) {
        return;
      }
      
      initializationRef.current = true;

      try {
        // Check permissions first
        const permissionsStatus = await checkPermissions();
        const permissionsNeeded = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
        
        if (!mountedRef.current) return;

        setNeedsPermissions(permissionsNeeded);

        if (!permissionsNeeded) {
          // Check authentication
          const storedToken = await storage.getAuthToken();
          
          if (storedToken && !user && mountedRef.current) {
            await dispatch(loadUser()).unwrap();
          }
        }
      } catch (error: any) {
        if (mountedRef.current) {
          console.error('[RootNavigator] Error:', error);
        }
      } finally {
        if (mountedRef.current) {
          setIsInitializing(false);
        }
      }
    }

    initializeApp();
  }, [dispatch, user]);

  const handleSplashComplete = useCallback(() => {
    if (mountedRef.current) {
      setIsSplashReady(true);
    }
  }, []);

  // Show splash screen while initializing or waiting for minimum time
  if (isInitializing || !isSplashReady) {
    return <SplashScreen onReady={handleSplashComplete} />;
  }

  const shouldShowAuth = !token || needsPermissions;
  
  return (
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
  );
} 