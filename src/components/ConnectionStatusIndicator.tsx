import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useThemeColors } from '../constants/theme';
import { useSelector } from 'react-redux';
import { selectConnectionState, selectIsConnected, selectIsReconnecting } from '../store';

export function ConnectionStatusIndicator() {
  const colors = useThemeColors();
  const [isVisible, setIsVisible] = useState(false);
  const connectionState = useSelector(selectConnectionState);
  const isConnected = useSelector(selectIsConnected);
  const isReconnecting = useSelector(selectIsReconnecting);
  const opacity = React.useRef(new Animated.Value(0)).current;

  const animateVisibility = useCallback((toValue: number, callback?: () => void) => {
    Animated.timing(opacity, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start(callback);
  }, [opacity]);

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
    };

    checkConnectionStatus();
    const intervalId = setInterval(checkConnectionStatus, 1000);

    return () => {
      clearInterval(intervalId);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [connectionState, isConnected, isReconnecting, animateVisibility, isVisible]);

  if (!isVisible || connectionState.appState !== 'active') return null;

  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'connected':
        return colors.success;
      case 'connecting':
        return colors.warning;
      case 'disconnected':
      case 'error':
        return colors.destructive;
      default:
        return colors.warning;
    }
  };

  const getMessage = () => {
    switch (connectionState.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return isReconnecting ? 'Reconnecting...' : 'Connecting...';
      case 'disconnected':
        return 'Connection lost';
      case 'error':
        const errorMessage = connectionState.error?.message;
        return errorMessage ? `Connection error: ${errorMessage}` : 'Connection error';
      default:
        return 'Connecting...';
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