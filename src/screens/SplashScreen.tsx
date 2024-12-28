import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useThemeColors } from '../constants/theme';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

const SPLASH_MIN_TIME = 1500; // 1.5 seconds

// Keep the splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync().catch((error: any) => {
	console.warn('[Splash] Error preventing auto hide:', error?.message || 'Unknown error');
});

export function SplashScreen({ onReady }: { onReady: () => void }) {
  const colors = useThemeColors();
  const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);
  const [hasLayout, setHasLayout] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': require('../../assets/fonts/Poppins/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMinTimeElapsed(true);
    }, SPLASH_MIN_TIME);

    return () => clearTimeout(timer);
  }, []);

  // Check conditions and proceed when ready
  useEffect(() => {
    const canProceed = (fontsLoaded || fontError) && isMinTimeElapsed && hasLayout;

    if (canProceed) {
      (async () => {
        try {
          await ExpoSplashScreen.hideAsync();
          onReady();
        } catch (error: any) {
			console.warn('[Splash] Error hiding splash screen:', error?.message || 'Unknown error');
        }
      })();
    }
  }, [fontsLoaded, fontError, isMinTimeElapsed, hasLayout, onReady]);

  const onLayoutRootView = useCallback(() => {
    setHasLayout(true);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View 
      style={[styles.container, { backgroundColor: colors.background }]}
      onLayout={onLayoutRootView}
    >
      <Image
        source={require('../../assets/splash.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '60%',
    height: '60%',
  },
}); 