import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useThemeColors } from '../constants/theme';
import socketService from '../services/socket';

export function ConnectionStatusIndicator() {
  const colors = useThemeColors();
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
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

    const checkConnectionStatus = () => {
      const isConnected = socketService.isConnected;
      const isReconnecting = socketService.isReconnecting;
      
      const newStatus = isConnected ? 'connected' : (isReconnecting ? 'connecting' : 'disconnected');
      const shouldShow = newStatus !== 'connected';
      
      if (shouldShow !== isVisible) {
        if (shouldShow) {
          setIsVisible(true);
          animateVisibility(1);
        } else {
          // Delay hiding when connected to show feedback
          hideTimeout = setTimeout(() => {
            animateVisibility(0, () => setIsVisible(false));
          }, 2000);
        }
      }
      
      setStatus(newStatus);
    };

    // Check status immediately and set up interval
    checkConnectionStatus();
    const intervalId = setInterval(checkConnectionStatus, 1000);

    return () => {
      clearInterval(intervalId);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [animateVisibility, isVisible]);

  if (!isVisible) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return colors.success;
      case 'connecting':
        return colors.warning;
      case 'disconnected':
        return colors.destructive;
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Connection lost';
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