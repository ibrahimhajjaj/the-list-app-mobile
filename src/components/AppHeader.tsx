import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Bell, BellOff, Sun, User } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { toggleNotifications } from '../store/slices/settingsSlice';

export function AppHeader() {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { notificationsEnabled } = useAppSelector((state) => state.settings);

  const handleNotificationToggle = () => {
    dispatch(toggleNotifications());
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image 
          source={require('../../assets/app-icon.png')} 
          style={styles.appIcon} 
        />
        <Text style={styles.appTitle}>The List App</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={handleNotificationToggle}
        >
          {notificationsEnabled ? (
            <Bell size={24} color={theme.colors.text} />
          ) : (
            <BellOff size={24} color={theme.colors.textLight} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <Sun size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={handleProfilePress}
        >
          <User size={32} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.m,
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
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