import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Bell, BellOff, Moon, Sun, User } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { toggleNotifications } from '../store/slices/settingsSlice';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList } from '../navigation/types';
import { useTheme } from '../contexts/ThemeContext';
import { useThemeColors } from '../constants/theme';
import { debugPanelManager, DebugPanel } from './DebugPanel';

type NavigationProp = NativeStackNavigationProp<MainTabParamList>;

export function AppHeader() {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { notificationsEnabled } = useAppSelector((state) => state.settings) || { notificationsEnabled: false };
  const { toggleTheme, isDark } = useTheme();
  const colors = useThemeColors();

  const handleNotificationToggle = () => {
    dispatch(toggleNotifications());
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  const handleProfileLongPress = () => {
    debugPanelManager.show();
  };

  return (
    <>
      <View style={[styles.header, { backgroundColor: colors.background, shadowColor: colors.shadowColor }]}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../../assets/app-icon.png')} 
            style={styles.appIcon} 
          />
          <Text style={[styles.appTitle, { color: colors.foreground }]}>The List App</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleNotificationToggle}
          >
            {notificationsEnabled ? (
              <Bell size={21} color={colors.foreground} />
            ) : (
              <BellOff size={21} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={toggleTheme}
          >
            {isDark ? (
              <Moon size={21} color={colors.foreground} />
            ) : (
              <Sun size={21} color={colors.foreground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfilePress}
            onLongPress={handleProfileLongPress}
            delayLongPress={1000}
          >
            <User size={21} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
      <DebugPanel />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xs,
    ...theme.shadows.small,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 32,
    height: 32,
    marginRight: theme.spacing.s,
    borderRadius: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: theme.spacing.s,
    marginLeft: theme.spacing.s,
  },
  profileButton: {
    padding: theme.spacing.s,
    marginLeft: theme.spacing.s,
  },
}); 