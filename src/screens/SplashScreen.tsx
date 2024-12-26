import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../navigation/types';
import { useAppDispatch } from '../hooks/redux';
import { loadUser } from '../store/slices/authSlice';
import { checkPermissions } from '../utils/permissions';

// Keep the splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

// Configure splash screen animation
ExpoSplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export function SplashScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<AuthStackScreenProps<'Splash'>['navigation']>();
  const dispatch = useAppDispatch();
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Try to load the user session
        await dispatch(loadUser()).unwrap();
        
        // Check permissions status
        const permissionsStatus = await checkPermissions();
        const needsPermissions = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
        
      } catch (error) {
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
      await ExpoSplashScreen.hideAsync();
      // Check permissions again in case they changed while splash was showing
      const permissionsStatus = await checkPermissions();
      const needsPermissions = !permissionsStatus.notifications || !permissionsStatus.batteryOptimization;
      
      // Navigate to appropriate screen based on permissions status
      navigation.replace(needsPermissions ? 'Permissions' : 'Login');
    }
  }, [appIsReady, navigation]);

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