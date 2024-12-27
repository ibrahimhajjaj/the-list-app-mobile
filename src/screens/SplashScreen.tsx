import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loadUser } from '../store/slices/authSlice';
import { checkPermissions } from '../utils/permissions';
import { storage } from '../services/storage';

// Keep the splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

export function SplashScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<AuthStackScreenProps<'Splash'>['navigation']>();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((state) => state.auth);
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('[Splash] Starting app initialization');
        
        // Check permissions first
        const permissionsStatus = await checkPermissions();
        const needsPermissions = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
        
        if (needsPermissions) {
          console.log('[Splash] Permissions needed, redirecting to permissions screen');
          setAppIsReady(true);
          return;
        }

        // Get stored token from SQLite
        const storedToken = await storage.getAuthToken();
        console.log('[Splash] Stored token status:', storedToken ? 'found' : 'not found');

        // Try to load the user session if we have a token
        if (storedToken) {
          console.log('[Splash] Token found, validating session');
          await dispatch(loadUser()).unwrap();
          console.log('[Splash] Session validated successfully');
        } else {
          console.log('[Splash] No token found, proceeding to login');
        }
      } catch (error) {
        console.error('[Splash] Error during initialization:', error);
        // If loading user fails, we'll handle it in the auth flow
      } finally {
        // Add a small delay to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 1000));
        setAppIsReady(true);
      }
    }

    prepare();
  }, [dispatch]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await ExpoSplashScreen.hideAsync();
        
        // Check permissions again in case they changed while splash was showing
        const permissionsStatus = await checkPermissions();
        const needsPermissions = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
        
        // Get current token state
        const storedToken = await storage.getAuthToken();
        
        if (needsPermissions) {
          navigation.replace('Permissions');
        } else if (!storedToken || loading) {
          navigation.replace('Login');
        } else {
          // Let RootNavigator handle the navigation since we have a valid token
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('[Splash] Error during navigation:', error);
        navigation.replace('Login');
      }
    }
  }, [appIsReady, navigation, loading]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View 
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={onLayoutRootView}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 