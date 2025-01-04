import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config';
import * as Notifications from 'expo-notifications';
import { store, RootState } from '../store';
import { authService } from './auth';
import { updateListInStore } from '../store/actions/listActionCreators';
import { shouldShowNotification } from '../store/slices/settingsSlice';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { notificationService } from './notificationService';
import { setConnectionStatus, setAppState } from '../store/slices/connectionSlice';

const BACKGROUND_FETCH_TASK = 'background-fetch';

interface PushRegistrationError {
  type: 'permission' | 'token' | 'network' | 'server';
  message: string;
  retryable: boolean;
}

class SocketService {
  private _socket: Socket | null = null;
  private subscribedLists: Set<string> = new Set();
  private pendingJoins: Set<string> = new Set();
  private notificationsInitialized: boolean = false;
  private recentNotifications: Set<string> = new Set();
  private cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
  private _isConnected: boolean = false;
  private _isReconnecting: boolean = false;
  private currentToken: string | null = null;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastPingTime: number = 0;
  private readonly PING_INTERVAL = 25000; // 25 seconds
  private readonly PING_TIMEOUT = 5000;   // 5 seconds
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds
  private retryCount: number = 0;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private appState: AppStateStatus = AppState.currentState;
  private pushRegistrationRetries: number = 0;
  private readonly MAX_PUSH_RETRIES = 3;
  private pushRegistrationTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastPushRegistrationAttempt: number = 0;
  private readonly PUSH_RETRY_DELAY = 60000; // 1 minute

  constructor() {
    this.setupAppStateListener();
    this.setupBackgroundFetch();
    // Initialize with disconnected state
    store.dispatch(setConnectionStatus({
      status: 'disconnected',
      isReconnecting: false
    }));
  }

  private setupAppStateListener() {
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    store.dispatch(setAppState(nextAppState));
    
    if (
      this.appState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      await this.handleForeground();
    } else if (
      this.appState === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      await this.handleBackground();
    }
    this.appState = nextAppState;
  };

  private async handleForeground() {
    if (this.currentToken) {
      store.dispatch(setConnectionStatus({
        status: 'connecting',
        isReconnecting: true
      }));

      try {
        const isNetworkAvailable = store.getState().network.isConnected && store.getState().network.isInternetReachable;
        
        if (isNetworkAvailable) {
          await this.connect(this.currentToken);
          
          // Only try to register push notifications after successful connection
          if (this._isConnected && !this.notificationsInitialized) {
            await this.initializeNotifications();
          }
        } else {
          await this.handleReconnect();
        }
      } catch (error) {
        await this.handleReconnect();
      }
    }
  }

  private async handleBackground() {
    // Disconnect socket but maintain subscriptions
    if (this._socket) {
      this._socket.disconnect();
      store.dispatch(setConnectionStatus({
        status: 'disconnected',
        isReconnecting: false
      }));
    }

    // Ensure we have push notifications set up as fallback
    if (!this.notificationsInitialized) {
      await this.initializeNotifications();
    }
  }

  private async setupBackgroundFetch() {
    try {
      if (Platform.OS === 'ios') {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 60 * 15, // 15 minutes
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }
    } catch (err) {
      console.error("Task Register failed:", err);
    }
  }

  private async initializeNotifications() {
    if (this.notificationsInitialized) return;

    try {
      await notificationService.initialize();
      const token = await notificationService.registerForPushNotifications();
      this.notificationsInitialized = !!token;
    } catch (error) {
      console.error('[SocketService] Error initializing notifications:', error);
    }
  }

  private async retryPushRegistration(error: PushRegistrationError) {
    if (!error.retryable || this.pushRegistrationRetries >= this.MAX_PUSH_RETRIES) {
      console.error('[SocketService] Push registration failed permanently:', error);
      return;
    }

    const now = Date.now();
    if (now - this.lastPushRegistrationAttempt < this.PUSH_RETRY_DELAY) {
      return;
    }

    this.pushRegistrationRetries++;
    this.lastPushRegistrationAttempt = now;

    if (this.pushRegistrationTimeout) {
      clearTimeout(this.pushRegistrationTimeout);
    }

    this.pushRegistrationTimeout = setTimeout(async () => {
      try {
        const token = await this.registerForPushNotifications();
        if (token) {
          await this.updatePushToken(token);
          this.pushRegistrationRetries = 0;
        }
      } catch (retryError) {
        console.error('[SocketService] Push registration retry failed:', retryError);
      }
    }, this.PUSH_RETRY_DELAY);
  }

  private async registerForPushNotifications() {
    let token;
    
    if (!Device.isDevice) {
      console.log('[SocketService] Push notifications are not available in simulator');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        await this.retryPushRegistration({
          type: 'permission',
          message: 'Permission not granted',
          retryable: true
        });
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync()).data;
      return token;
    } catch (error: unknown) {
      await this.retryPushRegistration({
        type: 'token',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      });
      return null;
    }
  }

  private async updatePushToken(token: string) {
    try {
      const response = await fetch(`${WS_URL}/api/users/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentToken}`
        },
        body: JSON.stringify({ pushToken: token })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error: unknown) {
      await this.retryPushRegistration({
        type: 'server',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true
      });
    }
  }

  get socket(): Socket | null {
    return this._socket;
  }

  get isConnected(): boolean {
    const connectionState = (store.getState() as RootState).connection;
    return connectionState.status === 'connected';
  }

  get isReconnecting(): boolean {
    const connectionState = (store.getState() as RootState).connection;
    return connectionState.isReconnecting;
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      const isOnline = store.getState().network.isConnected && store.getState().network.isInternetReachable === true;
      await authService.validateSession(isOnline);
      return true;
    } catch (error) {
      console.error('[SocketService] Token validation failed:', error);
      return false;
    }
  }

  private async handleReconnect() {
    const networkState = (store.getState() as RootState).network;
    const isNetworkAvailable = networkState.isConnected && networkState.isInternetReachable;

    if (!isNetworkAvailable) {
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      return;
    }

    this.retryCount++;
    
    // Exponential backoff with max delay and jitter
    const baseDelay = Math.min(
      this.INITIAL_RETRY_DELAY * Math.pow(2, this.retryCount - 1),
      this.MAX_RETRY_DELAY
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    store.dispatch(setConnectionStatus({
      status: 'connecting',
      isReconnecting: true
    }));

    this.retryTimeout = setTimeout(async () => {
      if (this.currentToken) {
        try {
          const shouldUseWebSocket = await this.checkWebSocketAvailability();
          
          if (shouldUseWebSocket) {
            await this.connect(this.currentToken);
          } else {
            await this.setupBackgroundFetch();
          }
        } catch (error) {
          console.error('[Socket] Reconnection attempt failed:', error);
          const currentNetworkState = (store.getState() as RootState).network;
          if (currentNetworkState.isConnected) {
            this.handleReconnect();
          }
        }
      } else {
        console.log('[Socket] No token available for reconnection');
      }
    }, delay);
  }

  private async checkWebSocketAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${WS_URL}/api/health`, {
        method: 'HEAD',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.currentToken}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const isAvailable = response.ok;
      
      return isAvailable;
    } catch (error) {
      console.error('[Socket] WebSocket health check failed:', {
        error,
        url: WS_URL,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.lastPingTime = Date.now();
    this.healthCheckInterval = setInterval(() => {
      if (!this._socket?.connected) return;

      const now = Date.now();
      if (now - this.lastPingTime > this.PING_INTERVAL + this.PING_TIMEOUT) {
        this._socket.disconnect();
        return;
      }

      this._socket.emit('ping');
      this.lastPingTime = now;
    }, this.PING_INTERVAL);
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async connect(token: string) {
    try {
      this.currentToken = token;

      const networkState = (store.getState() as RootState).network;
      const isNetworkAvailable = networkState.isConnected && networkState.isInternetReachable;

      if (!isNetworkAvailable) {
        store.dispatch(setConnectionStatus({
          status: 'disconnected',
          error: new Error('No network connection'),
          isReconnecting: false
        }));
        await this.handleReconnect();
        return;
      }

      const isValid = await this.validateToken(token);
      
      if (!isValid) {
        store.dispatch(setConnectionStatus({
          status: 'error',
          error: new Error('Invalid token'),
          isReconnecting: false
        }));
        return;
      }

      const isWebSocketAvailable = await this.checkWebSocketAvailability();

      if (!isWebSocketAvailable) {
        store.dispatch(setConnectionStatus({
          status: 'error',
          error: new Error('WebSocket endpoint not available'),
          isReconnecting: false
        }));
        await this.handleReconnect();
        return;
      }

      if (this._socket) {
        this.disconnect();
      }

      store.dispatch(setConnectionStatus({
        status: 'connecting',
        isReconnecting: false
      }));

      this._socket = io(WS_URL, {
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        forceNew: true,
        timeout: 10000,
        extraHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });

      const connectionTimeout = setTimeout(() => {
        if (!this._socket?.connected) {
          this._socket?.disconnect();
          store.dispatch(setConnectionStatus({
            status: 'error',
            error: new Error('Connection timeout'),
            isReconnecting: false
          }));
          this.handleReconnect();
        }
      }, 10000);

      this._socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        store.dispatch(setConnectionStatus({
          status: 'connected',
          isReconnecting: false,
          lastConnected: new Date().toISOString()
        }));
        
        this.retryCount = 0;
        this.lastPingTime = Date.now();
        this._isConnected = true;
        
        if (this.pendingJoins.size > 0) {
          this.pendingJoins.forEach(listId => {
            this.joinList(listId);
          });
          this.pendingJoins.clear();
        }
      });

      await this.initializeNotifications();
      this.setupEventListeners();
      this.startHealthCheck();

      if (this.cleanupTimeout) {
        clearInterval(this.cleanupTimeout);
      }
      this.cleanupTimeout = setInterval(() => this.cleanupOldNotifications(), 5000);
    } catch (error) {
      console.error('[Socket] Connection error:', error);
      store.dispatch(setConnectionStatus({
        status: 'error',
        error: error as Error,
        isReconnecting: false
      }));
      await this.handleReconnect();
    }
  }

  disconnect() {
    this.stopHealthCheck();
    
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
      this._isConnected = false;
      
      // Only clear token if this is a full disconnect (not background)
      if (this.appState === 'active') {
        this.currentToken = null;
      }
      
      this.subscribedLists.clear();
      this.pendingJoins.clear();
      this.retryCount = 0;
      
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }

      if (this.cleanupTimeout) {
        clearTimeout(this.cleanupTimeout);
        this.cleanupTimeout = null;
      }
    }
  }

  joinList(listId: string) {
    if (!this._socket?.connected) {
      this.pendingJoins.add(listId);
      return;
    }

    if (this.subscribedLists.has(listId)) {
      return;
    }

    this._socket.emit('joinList', listId);
    this.subscribedLists.add(listId);
    this.pendingJoins.delete(listId);
  }

  leaveList(listId: string) {
    if (!this._socket?.connected) {
      this.subscribedLists.delete(listId);
      this.pendingJoins.delete(listId);
      return;
    }

    if (!this.subscribedLists.has(listId)) {
      return;
    }

    this._socket.emit('leaveList', listId);
    this.subscribedLists.delete(listId);
    this.pendingJoins.delete(listId);
  }

  private cleanupOldNotifications() {
    // Clear notifications older than 5 seconds
    this.recentNotifications.clear();
  }

  private setupEventListeners() {
    if (!this._socket) return;

    this._socket.on('connect_error', (error: Error) => {
      console.error('[Socket] Connection error:', error, {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      store.dispatch(setConnectionStatus({
        status: 'error',
        error,
        isReconnecting: false
      }));
      
      this.handleReconnect();
    });

    this._socket.on('connect', () => {
      store.dispatch(setConnectionStatus({
        status: 'connected',
        isReconnecting: false,
        lastConnected: new Date().toISOString()
      }));
      
      this.retryCount = 0;
      this.lastPingTime = Date.now();
      this._isConnected = true;
      
      if (this.pendingJoins.size > 0) {
        this.pendingJoins.forEach(listId => {
          this.joinList(listId);
        });
        this.pendingJoins.clear();
      }
    });

    this._socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        store.dispatch(setConnectionStatus({
          status: 'disconnected',
          isReconnecting: false
        }));
        return;
      }
      
      this.handleReconnect();
    });

    this._socket.on('error', () => {
      this._isConnected = false;
      this.handleReconnect();
    });

    this._socket.on('notification', async (data: { type: string; data: any }) => {
      if (data.type === 'new_notification' && this.notificationsInitialized) {
        const notificationKey = `${data.data._id}-${data.data.createdAt}`;
        
        if (this.recentNotifications.has(notificationKey)) {
          return;
        }
        
        this.recentNotifications.add(notificationKey);

        const message = data.data.message.toLowerCase();
        let type: 'title_change' | 'item_add' | 'item_delete' | 'item_edit' | 'item_complete';
        
        if (message.includes('renamed')) {
          type = 'title_change';
        } else if (message.includes('added')) {
          type = 'item_add';
        } else if (message.includes('deleted')) {
          type = 'item_delete';
        } else if (message.includes('edited')) {
          type = 'item_edit';
        } else if (message.includes('marked')) {
          type = 'item_complete';
        } else {
          type = 'item_edit';
        }

        const settings = store.getState().settings;
        const shouldShow = shouldShowNotification(settings, type);

        if (shouldShow) {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'List Update',
                body: data.data.message,
                data: { ...data.data },
              },
              trigger: null,
            });
          } catch (error) {
            // Silent error handling
          }
        }
      }
    });

    this._socket.on('listUpdated', (data: { type: string; listId: string; data: any; updatedBy: any; changes: any }) => {
      if (this.subscribedLists.has(data.listId)) {
        store.dispatch(updateListInStore(data.data));
      }
    });

    this._socket.on('pong', () => {
      this.lastPingTime = Date.now();
    });
  }

  // Add method to check if connected to a specific list
  isSubscribedToList(listId: string): boolean {
    return this.subscribedLists.has(listId);
  }
}

// Register background fetch task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const notifications = await notificationService.getPendingNotifications();
    let hasNewData = false;

    // Schedule local notifications for updates
    for (const notification of notifications) {
      const notificationId = await notificationService.scheduleNotification(
        notification.title || 'List Update',
        notification.message,
        {
          type: notification.type,
          listId: notification.relatedId,
          notificationId: notification._id
        }
      );

      if (notificationId) {
        hasNewData = true;
      }
    }

    return hasNewData ? 2 : 1; // BackgroundFetch.Result.NewData : BackgroundFetch.Result.NoData
  } catch (error) {
    console.error("Background fetch failed:", error);
    return 0; // BackgroundFetch.Result.Failed
  }
});

export const socketService = new SocketService();
export default socketService; 