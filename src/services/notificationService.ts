import api from './api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { store } from '../store';
import { shouldShowNotification } from '../store/slices/settingsSlice';
import { EXPO_PROJECT_ID } from '../config/index';
import { loggerService } from './loggerService';

export interface NotificationSettings {
  shouldShowAlert: boolean;
  shouldPlaySound: boolean;
  shouldSetBadge: boolean;
}

export type NotificationType = 'title_change' | 'item_add' | 'item_delete' | 'item_edit' | 'item_complete';

class NotificationService {
  private notificationsInitialized: boolean = false;
  private pushToken: string | null = null;

  async initialize(): Promise<void> {
    if (this.notificationsInitialized) return;

    try {
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      await this.requestPermissions();
      await this.configurePushNotifications();
      
      // Set up notification received handler
      const subscription = Notifications.addNotificationReceivedListener(this.handleNotificationReceived);
      
      this.notificationsInitialized = true;
    } catch (error) {
      await loggerService.logPushNotificationError('Initialization error', error);
      throw error;
    }
  }

  private handleNotificationReceived = async (notification: Notifications.Notification) => {
    const notificationType = notification.request.content.data?.type as NotificationType;
    if (!notificationType) return;

    const settings = store.getState().settings;
    const shouldShow = shouldShowNotification(settings, notificationType);

    if (!shouldShow) {
      await Notifications.dismissNotificationAsync(notification.request.identifier);
    }
  };

  private async configurePushNotifications(): Promise<void> {
    try {
      await Notifications.setNotificationHandler({
        handleNotification: async (notification: Notifications.Notification) => {
          const notificationType = notification.request.content.data?.type as NotificationType;
          const settings = store.getState().settings;
          const shouldShow = notificationType ? shouldShowNotification(settings, notificationType) : true;

          return {
            shouldShowAlert: shouldShow,
            shouldPlaySound: shouldShow,
            shouldSetBadge: shouldShow,
          };
        },
      });
    } catch (error) {
      await loggerService.logPushNotificationError('Error configuring push notification handler', error);
      throw error;
    }
  }

  async scheduleNotification(
    title: string,
    body: string,
    data: { type: NotificationType; [key: string]: any }
  ): Promise<string | null> {
    try {
      const settings = store.getState().settings;
      const shouldShow = shouldShowNotification(settings, data.type);

      if (!shouldShow) {
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            notificationId: Date.now().toString(),
          },
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      await loggerService.logPushNotificationError('Error scheduling notification', error, {
        title,
        body,
        data
      });
      return null;
    }
  }

  private async setupAndroidChannel(): Promise<void> {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (error) {
      await loggerService.logPushNotificationError('Failed to setup Android notification channel', error);
      throw error;
    }
  }

  private async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      await loggerService.logPushNotificationError('Error requesting permissions', error);
      return false;
    }
  }

  async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID || 'development'
      });
      
      if (!tokenData.data) {
        await loggerService.logPushNotificationError('Failed to get push token', null, {
          tokenData
        });
        return null;
      }

      this.pushToken = tokenData.data;

      try {
        await this.registerPushToken(this.pushToken);
      } catch (error) {
        await loggerService.logPushNotificationError('Failed to register push token with backend', error, { 
          token: this.pushToken,
          userId: store.getState().auth.user?._id
        });
        this.pushToken = null;
        return null;
      }

      return this.pushToken;
    } catch (error) {
      await loggerService.logPushNotificationError('Error registering for push notifications', error);
      return null;
    }
  }

  async registerPushToken(token: string): Promise<void> {
    try {
      await api.post('/users/push-token', { pushToken: token });
    } catch (error) {
      await loggerService.logPushNotificationError('Error registering push token', error, { token });
      throw error;
    }
  }

  async unregisterPushToken(token: string): Promise<void> {
    try {
      await api.delete('/users/push-token', { data: { pushToken: token } });
      this.pushToken = null;
    } catch (error) {
      await loggerService.logPushNotificationError('Error unregistering push token', error, { token });
      throw error;
    }
  }

  async getPendingNotifications(since?: Date): Promise<any[]> {
    try {
      const params = since ? { since: since.toISOString() } : undefined;
      const response = await api.get('/notifications/pending', { params });
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error fetching pending notifications:', error);
      throw error;
    }
  }

  async getAllNotifications(): Promise<any[]> {
    try {
      const response = await api.get('/notifications');
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error fetching all notifications:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('[NotificationService] Error marking notification as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await api.delete(`/notifications/${notificationId}`);
    } catch (error) {
      console.error('[NotificationService] Error deleting notification:', error);
      throw error;
    }
  }

  getCurrentPushToken(): string | null {
    return this.pushToken;
  }
}

export const notificationService = new NotificationService();
export default notificationService; 