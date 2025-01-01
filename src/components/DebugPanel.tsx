import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Modal, Platform } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import { useAppSelector } from '../hooks/redux';
import { DatabaseInspector } from './DatabaseInspector';
import { OfflineTestRunner } from './OfflineTestRunner';
import { User, Settings, Database, Upload } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api';

interface UserDebugInfo {
  pushToken: string | null;
  notificationPermissions: string;
  deviceType: string;
  deviceInfo: {
    brand: string | null;
    manufacturer: string | null;
    modelName: string | null;
    modelId: string | null;
    designName: string | null;
    productName: string | null;
    deviceYearClass: number | null;
    totalMemory: number | null;
    supportedCPUArchitectures: string[] | null;
    osName: string | null;
    osVersion: string | null;
    osBuildId: string | null;
    osInternalBuildId: string | null;
    platformApiLevel: number | null;
    deviceName: string | null;
  };
  appInfo: {
    appVersion: string | null;
    nativeAppVersion: string | null;
    nativeBuildVersion: string | null;
    expoVersion: string | null;
    installationId: string | null;
    sessionId: string | null;
  };
  networkInfo: {
    type: string | null;
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    isWifiEnabled: boolean | null;
    details: any;
  };
}

// Create a singleton instance to manage modal visibility
class DebugPanelManager {
  private static instance: DebugPanelManager;
  private setVisibleCallback: ((visible: boolean) => void) | null = null;

  private constructor() {}

  static getInstance(): DebugPanelManager {
    if (!DebugPanelManager.instance) {
      DebugPanelManager.instance = new DebugPanelManager();
    }
    return DebugPanelManager.instance;
  }

  setCallback(callback: (visible: boolean) => void) {
    this.setVisibleCallback = callback;
  }

  show() {
    if (this.setVisibleCallback) {
      this.setVisibleCallback(true);
    }
  }

  hide() {
    if (this.setVisibleCallback) {
      this.setVisibleCallback(false);
    }
  }
}

export const debugPanelManager = DebugPanelManager.getInstance();

export function DebugPanel() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'database' | 'offline'>('user');
  const [userDebugInfo, setUserDebugInfo] = useState<UserDebugInfo | null>(null);
  const [isSendingDebugInfo, setIsSendingDebugInfo] = useState(false);
  const colors = useThemeColors();
  const user = useAppSelector(state => state.auth.user);
  const networkState = useAppSelector(state => state.network);
  const settings = useAppSelector(state => state.settings);

  useEffect(() => {
    debugPanelManager.setCallback(setIsModalVisible);
  }, []);

  useEffect(() => {
    if (isModalVisible) {
      fetchUserDebugInfo();
    }
  }, [isModalVisible]);

  const fetchUserDebugInfo = async () => {
    try {
      const token = await notificationService.getCurrentPushToken();
      const { status } = await Notifications.getPermissionsAsync();
      const deviceType = await Notifications.getDevicePushTokenAsync();
      const netInfo = await NetInfo.fetch();

      setUserDebugInfo({
        pushToken: token,
        notificationPermissions: status,
        deviceType: JSON.stringify(deviceType, null, 2),
        deviceInfo: {
          brand: Device.brand,
          manufacturer: Device.manufacturer,
          modelName: Device.modelName,
          modelId: Device.modelId,
          designName: Device.designName,
          productName: Device.productName,
          deviceYearClass: await Device.getDeviceTypeAsync(),
          totalMemory: await Device.getMaxMemoryAsync(),
          supportedCPUArchitectures: Device.supportedCpuArchitectures,
          osName: Device.osName,
          osVersion: Device.osVersion,
          osBuildId: Device.osBuildId,
          osInternalBuildId: Device.osInternalBuildId,
          platformApiLevel: Device.platformApiLevel,
          deviceName: String(await Device.getDeviceTypeAsync()),
        },
        appInfo: {
          appVersion: Constants.expoConfig?.version || null,
          nativeAppVersion: Constants.nativeAppVersion,
          nativeBuildVersion: Constants.nativeBuildVersion,
          expoVersion: Constants.expoVersion,
          installationId: Constants.installationId,
          sessionId: Constants.sessionId,
        },
        networkInfo: {
          type: netInfo.type,
          isConnected: netInfo.isConnected || null,
          isInternetReachable: netInfo.isInternetReachable || null,
          isWifiEnabled: netInfo.isWifiEnabled || null,
          details: netInfo.details,
        },
      });
    } catch (error) {
      console.error('Error fetching debug info:', error);
    }
  };

  const sendDebugInfoToServer = async () => {
    try {
      setIsSendingDebugInfo(true);
      const debugData = {
        timestamp: new Date().toISOString(),
        user: {
          id: user?._id,
          name: user?.name,
          email: user?.email,
        },
        settings,
        networkState,
        deviceInfo: userDebugInfo?.deviceInfo,
        appInfo: userDebugInfo?.appInfo,
        pushNotifications: {
          token: userDebugInfo?.pushToken,
          permissions: userDebugInfo?.notificationPermissions,
          deviceType: userDebugInfo?.deviceType,
        },
        networkInfo: userDebugInfo?.networkInfo,
        platform: {
          OS: Platform.OS,
          Version: Platform.Version,
          isTV: Platform.isTV,
          constants: Platform.constants,
        },
      };

      await api.post('/debug/log', debugData);
      alert('Debug information sent successfully');
    } catch (error) {
      console.error('Error sending debug info:', error);
      alert('Failed to send debug information');
    } finally {
      setIsSendingDebugInfo(false);
    }
  };

  const renderUserDebugInfo = () => (
    <ScrollView style={styles.contentContainer}>
      <TouchableOpacity
        style={[styles.sendButton, { backgroundColor: colors.primary }]}
        onPress={sendDebugInfoToServer}
        disabled={isSendingDebugInfo}
      >
        <Upload size={20} color={colors.primaryForeground} />
        <Text style={[styles.sendButtonText, { color: colors.primaryForeground }]}>
          {isSendingDebugInfo ? 'Sending...' : 'Send Debug Info'}
        </Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>User Information</Text>
        <View style={styles.infoContainer}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>ID:</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{user?._id || 'Not logged in'}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Name:</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{user?.name || 'N/A'}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Email:</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{user?.email || 'N/A'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Push Notification Status</Text>
        <View style={styles.infoContainer}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Current Token:</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{userDebugInfo?.pushToken || 'No token'}</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Permissions:</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{userDebugInfo?.notificationPermissions || 'Unknown'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Device Information</Text>
        {userDebugInfo?.deviceInfo && Object.entries(userDebugInfo.deviceInfo).map(([key, value]) => (
          <View key={key} style={styles.infoContainer}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{key}:</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{value?.toString() || 'N/A'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>App Information</Text>
        {userDebugInfo?.appInfo && Object.entries(userDebugInfo.appInfo).map(([key, value]) => (
          <View key={key} style={styles.infoContainer}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{key}:</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>{value || 'N/A'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Network Status</Text>
        {userDebugInfo?.networkInfo && Object.entries(userDebugInfo.networkInfo).map(([key, value]) => (
          <View key={key} style={styles.infoContainer}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{key}:</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setIsModalVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Debug Panel</Text>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.muted }]}
            onPress={() => setIsModalVisible(false)}
          >
            <Text style={[styles.closeButtonText, { color: colors.mutedForeground }]}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'user' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setActiveTab('user')}
          >
            <User size={20} color={activeTab === 'user' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'user' ? colors.primaryForeground : colors.mutedForeground }
            ]}>User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'database' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setActiveTab('database')}
          >
            <Database size={20} color={activeTab === 'database' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'database' ? colors.primaryForeground : colors.mutedForeground }
            ]}>Database</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'offline' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setActiveTab('offline')}
          >
            <Settings size={20} color={activeTab === 'offline' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'offline' ? colors.primaryForeground : colors.mutedForeground }
            ]}>Tests</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'user' && renderUserDebugInfo()}
        {activeTab === 'database' && <DatabaseInspector />}
        {activeTab === 'offline' && <OfflineTestRunner />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    ...theme.shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: theme.spacing.m,
    gap: theme.spacing.m,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    gap: theme.spacing.s,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: theme.spacing.m,
  },
  section: {
    marginBottom: theme.spacing.l,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.light.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: theme.spacing.m,
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.s,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    flex: 2,
    fontSize: 14,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    marginBottom: theme.spacing.m,
    gap: theme.spacing.s,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 