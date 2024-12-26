import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Battery from 'expo-battery';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { theme } from '../../constants/theme';
import { useThemeColors } from '../../constants/theme';

type PermissionStatus = 'pending' | 'granted' | 'denied';

export function PermissionsScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>('pending');
  const [batteryOptStatus, setBatteryOptStatus] = useState<PermissionStatus>('pending');
  const [isRequestingBatteryOpt, setIsRequestingBatteryOpt] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    // Check notification permission
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationStatus(status === 'granted' ? 'granted' : 'denied');

    // Check battery optimization status (Android only)
    if (Platform.OS === 'android') {
      const batteryOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
      setBatteryOptStatus(batteryOptimizationEnabled ? 'denied' : 'granted');
    }
  };

  const requestNotificationPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationStatus(status === 'granted' ? 'granted' : 'denied');
  };

  const requestBatteryOptimization = async () => {
    if (Platform.OS === 'android' && !isRequestingBatteryOpt) {
      try {
        setIsRequestingBatteryOpt(true);
        
        const packageName = Constants.expoConfig?.android?.package || 'com.ibrahimwithi.thelistapp';

        console.log('[Battery Opt] Starting request with package:', packageName);
        console.log('[Battery Opt] Platform version:', Platform.Version);
        
        const initialStatus = await Battery.isBatteryOptimizationEnabledAsync();
        console.log('[Battery Opt] Initial battery optimization status:', initialStatus);

        try {
          // Try using Linking first
          const canOpenSettings = await Linking.canOpenURL('package:' + packageName);
          console.log('[Battery Opt] Can open settings:', canOpenSettings);
          
          if (canOpenSettings) {
            await Linking.openURL('package:' + packageName);
            console.log('[Battery Opt] Opened settings via Linking');
          } else {
            // Fallback to IntentLauncher
            console.log('[Battery Opt] Falling back to IntentLauncher');
            const result = await IntentLauncher.startActivityAsync(
              'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
              { data: 'package:' + packageName }
            );
            console.log('[Battery Opt] IntentLauncher result:', result);
          }
        } catch (error) {
          console.log('[Battery Opt] Error opening settings:', error);
          // Final fallback: open battery settings
          await IntentLauncher.startActivityAsync(
            'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
          );
        }

        // Wait a bit and check the status again
        setTimeout(async () => {
          const batteryOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
          console.log('[Battery Opt] Post-request battery optimization status:', batteryOptimizationEnabled);
          setBatteryOptStatus(batteryOptimizationEnabled ? 'denied' : 'granted');
          setIsRequestingBatteryOpt(false);
        }, 1000);

      } catch (error) {
        console.error('[Battery Opt] Error:', error);
        if (error instanceof Error) {
          console.error('[Battery Opt] Error details:', {
            message: error.message,
            stack: error.stack
          });
        }
        setIsRequestingBatteryOpt(false);
      }
    } else {
      console.log('[Battery Opt] Skipped - Platform:', Platform.OS, 'isRequesting:', isRequestingBatteryOpt);
    }
  };

  const handleContinue = () => {
    navigation.navigate('Login' as never);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>App Permissions</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Please enable the following permissions to get the best experience
        </Text>

        <View style={styles.permissionsContainer}>
          <View style={[styles.permissionItem, { borderColor: colors.border }]}>
            <View style={styles.permissionHeader}>
              <Text style={[styles.permissionTitle, { color: colors.foreground }]}>Notifications</Text>
              <TouchableOpacity
                style={[
                  styles.permissionButton,
                  {
                    backgroundColor:
                      notificationStatus === 'granted' ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={requestNotificationPermission}
              >
                <Text
                  style={[
                    styles.permissionButtonText,
                    {
                      color:
                        notificationStatus === 'granted'
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {notificationStatus === 'granted' ? 'Enabled' : 'Enable'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.permissionDescription, { color: colors.mutedForeground }]}>
              Stay updated with important list changes and reminders
            </Text>
          </View>

          {Platform.OS === 'android' && (
            <View style={[styles.permissionItem, { borderColor: colors.border }]}>
              <View style={styles.permissionHeader}>
                <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
                  Battery Optimization
                </Text>
                <TouchableOpacity
                  style={[
                    styles.permissionButton,
                    {
                      backgroundColor:
                        batteryOptStatus === 'granted' ? colors.primary : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={requestBatteryOptimization}
                  disabled={isRequestingBatteryOpt}
                >
                  <Text
                    style={[
                      styles.permissionButtonText,
                      {
                        color:
                          batteryOptStatus === 'granted'
                            ? colors.primaryForeground
                            : colors.foreground,
                      },
                    ]}
                  >
                    {isRequestingBatteryOpt 
                      ? 'Opening...' 
                      : batteryOptStatus === 'granted' 
                        ? 'Enabled' 
                        : 'Enable'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.permissionDescription, { color: colors.mutedForeground }]}>
                Allow the app to run in the background for timely notifications
              </Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: colors.primary }]}
        onPress={handleContinue}
      >
        <Text style={[styles.continueButtonText, { color: colors.primaryForeground }]}>
          Continue
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: theme.spacing.l,
    paddingTop: Platform.OS === 'android' ? theme.spacing.xl + theme.spacing.m : theme.spacing.m,
  },
  title: {
    fontSize: 28,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.s,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 20,
  },
  permissionsContainer: {
    gap: theme.spacing.l,
    paddingTop: theme.spacing.m,
  },
  permissionItem: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.m,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.s,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
    marginRight: theme.spacing.s,
  },
  permissionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  permissionButton: {
    height: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 90,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.fontWeight.medium,
  },
  continueButton: {
    margin: theme.spacing.l,
    height: 48,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: theme.typography.fontWeight.bold,
  },
}); 