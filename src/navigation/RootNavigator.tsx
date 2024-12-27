import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loadUser } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { RootStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { storage } from '../services/storage';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const dispatch = useAppDispatch();
  const { token, loading, user } = useAppSelector((state) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    async function initializeAuth() {
      try {
        const storedToken = await storage.getAuthToken();
        if (storedToken && !user) {
          console.log('[RootNavigator] Stored token found, validating session');
          await dispatch(loadUser()).unwrap();
        }
      } catch (error) {
        console.error('[RootNavigator] Error initializing auth:', error);
      } finally {
        setIsInitializing(false);
      }
    }

    initializeAuth();
  }, [dispatch, user]);

  // Show splash screen while loading or initializing
  if (loading || isInitializing) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <Stack.Screen 
          name="Auth" 
          component={AuthNavigator}
          options={{
            animationTypeForReplace: !token ? 'pop' : 'push',
          }}
        />
      ) : (
        <Stack.Screen 
          name="Main" 
          component={MainNavigator}
          options={{
            animationTypeForReplace: 'push',
          }}
        />
      )}
    </Stack.Navigator>
  );
} 