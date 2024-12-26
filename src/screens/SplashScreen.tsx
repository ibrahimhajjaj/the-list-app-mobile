import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useNavigation } from '@react-navigation/native';
import type { AuthStackScreenProps } from '../navigation/types';
import { useAppDispatch } from '../hooks/redux';
import { loadUser } from '../store/slices/authSlice';

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
        const resultAction = await dispatch(loadUser()).unwrap();
        if (resultAction?.user) {
          console.log('[Splash] User session restored successfully');
        }
      } catch (error) {
        // If loading user fails, we'll handle it in the auth flow
        console.log('[Splash] No valid session found:', error);
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
      navigation.replace('Permissions');
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