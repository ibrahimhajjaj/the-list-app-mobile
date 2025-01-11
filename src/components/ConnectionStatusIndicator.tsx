import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useThemeColors } from '../constants/theme';
import { useSelector } from 'react-redux';
import { selectAppState, selectIsAppActive } from '../store';
import { RootState } from '../store';

export function ConnectionStatusIndicator() {
  const colors = useThemeColors();
  const [isVisible, setIsVisible] = useState(false);
  const socketState = useSelector((state: RootState) => state.socket);
  const appState = useSelector(selectAppState);
  const isAppActive = useSelector(selectIsAppActive);
  const networkState = useSelector((state: RootState) => state.network);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const [previousStatus, setPreviousStatus] = useState(socketState.isConnected);

  const animateVisibility = useCallback((toValue: number, callback?: () => void) => {
    Animated.timing(opacity, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start(callback);
  }, [opacity]);

  const getMessage = useCallback(() => {
    if (!networkState.isConnected) {
      return 'No network connection';
    }
    if (!networkState.isInternetReachable) {
      return 'Checking internet connection...';
    }

    // Check if we're in a cleanup phase during reconnection
    const isCleanupPhase = !socketState.isConnected && 
      previousStatus &&
      socketState.reconnectAttempts > 0;

    if (isCleanupPhase) {
      return 'Reconnecting...';
    }

    if (!socketState.isInitialized) {
      return 'Initializing...';
    }

    if (socketState.isConnected) {
      return 'Connected';
    }

    if (socketState.lastError) {
      if (socketState.lastError.includes('timeout')) {
        return 'Connection timeout';
      }
      if (socketState.lastError.includes('WebSocket')) {
        return 'Server unavailable';
      }
      if (socketState.lastError.includes('transport error') || socketState.reconnectAttempts > 0) {
        return 'Reconnecting...';
      }
      return 'Connection error';
    }

    return 'Connecting...';
  }, [
    socketState.isInitialized,
    socketState.isConnected,
    socketState.lastError,
    socketState.reconnectAttempts,
    previousStatus,
    networkState.isConnected,
    networkState.isInternetReachable
  ]);

  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;

    const checkConnectionStatus = () => {
      if (!isAppActive) {
        setIsVisible(false);
        return;
      }

      const shouldShow = !socketState.isConnected && socketState.isInitialized;
      
      if (shouldShow !== isVisible) {
        if (shouldShow) {
          setIsVisible(true);
          animateVisibility(1);
        } else {
          hideTimeout = setTimeout(() => {
            animateVisibility(0, () => setIsVisible(false));
          }, 2000);
        }
      }
    };

    checkConnectionStatus();
    const intervalId = setInterval(checkConnectionStatus, 1000);

    return () => {
      clearInterval(intervalId);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [socketState, isAppActive, animateVisibility, isVisible, networkState, getMessage]);

  useEffect(() => {
    setPreviousStatus(socketState.isConnected);
  }, [socketState.isConnected]);

  if (!isVisible || !isAppActive) return null;

  const getStatusColor = () => {
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return colors.warning;
    }

    if (socketState.isConnected) {
      return colors.success;
    }

    if (socketState.reconnectAttempts > 0 || socketState.lastError?.includes('transport error')) {
      return colors.warning;
    }

    return colors.destructive;
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.popover,
          borderColor: colors.border,
          opacity,
          ...Platform.select({
            ios: {
              shadowColor: colors.foreground,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
            android: {
              elevation: 3,
            },
          }),
        }
      ]}
    >
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      <Text style={[styles.text, { color: colors.foreground }]}>
        {getMessage()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 999000,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
}); 