import * as Notifications from 'expo-notifications';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';

export interface PermissionStatus {
  notifications: boolean;
  batteryOptimization: boolean;
}

export async function checkPermissions(): Promise<PermissionStatus> {
  // Check notification permission
  const { status: notificationStatus } = await Notifications.getPermissionsAsync();
  
  // Check battery optimization (Android only)
  let batteryOptimizationDisabled = true;
  if (Platform.OS === 'android') {
    const batteryOptimizationEnabled = await Battery.isBatteryOptimizationEnabledAsync();
    batteryOptimizationDisabled = !batteryOptimizationEnabled;
  }

  return {
    notifications: notificationStatus === 'granted',
    batteryOptimization: batteryOptimizationDisabled
  };
} 