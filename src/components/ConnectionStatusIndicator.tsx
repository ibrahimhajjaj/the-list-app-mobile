import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useThemeColors } from '../constants/theme';
import { useSelector } from 'react-redux';
import { selectConnectionState, selectIsConnected, selectIsReconnecting } from '../store';
import { RootState } from '../store';

export function ConnectionStatusIndicator() {
  const colors = useThemeColors();
  const [isVisible, setIsVisible] = useState(false);
  const connectionState = useSelector(selectConnectionState);
  const isConnected = useSelector(selectIsConnected);
  const isReconnecting = useSelector(selectIsReconnecting);
  const networkState = useSelector((state: RootState) => state.network);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const [previousStatus, setPreviousStatus] = useState(connectionState.status);

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
    const isCleanupPhase = connectionState.status === 'disconnected' && 
      previousStatus === 'connecting' &&
      isReconnecting;

    if (isCleanupPhase) {
      return 'Reconnecting...';
    }

    switch (connectionState.status) {
      case 'connected':
        return 'Connected';
      case 'connecting': {
        const hasTransportError = connectionState.error?.message?.includes('transport error');
        if (hasTransportError || isReconnecting) {
          return 'Reconnecting...';
        }
        return 'Connecting...';
      }
      case 'disconnected': {
        const isTransportError = connectionState.error?.message?.includes('transport error');
        if (isTransportError || isReconnecting) {
          return 'Reconnecting...';
        }
        return connectionState.error ? 'Connection failed' : 'Connection lost';
      }
      case 'error': {
        if (isReconnecting) {
          return 'Reconnecting...';
        }
        if (connectionState.error?.message?.includes('timeout')) {
          return 'Connection timeout';
        }
        if (connectionState.error?.message?.includes('WebSocket')) {
          return 'Server unavailable';
        }
        return 'Connection error';
      }
      default:
        return 'Connecting...';
    }
  }, [
    connectionState.status,
    connectionState.error,
    previousStatus,
    isReconnecting,
    networkState.isConnected,
    networkState.isInternetReachable
  ]);

  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;
    let previousStatus = connectionState.status;

    const checkConnectionStatus = () => {
      if (connectionState.appState !== 'active') {
        setIsVisible(false);
        return;
      }

      const shouldShow = !isConnected && connectionState.status !== 'initializing';
      
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
      previousStatus = connectionState.status;
    };

    checkConnectionStatus();
    const intervalId = setInterval(checkConnectionStatus, 1000);

    return () => {
      clearInterval(intervalId);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [connectionState, isConnected, isReconnecting, animateVisibility, isVisible, networkState, getMessage]);

  useEffect(() => {
    setPreviousStatus(connectionState.status);
  }, [connectionState.status]);

  if (!isVisible || connectionState.appState !== 'active') return null;

  const getStatusColor = () => {
    if (!networkState.isConnected || !networkState.isInternetReachable) {
      return colors.warning;
    }

    switch (connectionState.status) {
      case 'connected':
        return colors.success;
      case 'connecting':
      case 'disconnected':
        if (isReconnecting || connectionState.error?.message?.includes('transport error')) {
          return colors.warning;
        }
        return connectionState.status === 'connecting' ? colors.warning : colors.destructive;
      case 'error':
        return isReconnecting ? colors.warning : colors.destructive;
      default:
        return colors.warning;
    }
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