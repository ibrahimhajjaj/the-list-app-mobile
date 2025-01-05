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
  private lastNetworkState: { isConnected: boolean; isInternetReachable: boolean | null } = {
    isConnected: true,
    isInternetReachable: null
  };
  private isConnecting: boolean = false;
  private readonly MAX_RETRIES = {
    'transport error': 10,        // Network related, keep trying
    'transport close': 10,        // Network related, keep trying
    'ping timeout': 5,           // Might be server issue
    'server disconnect': 0,      // Server explicitly disconnected us
    'client disconnect': 0,      // We disconnected ourselves
    'server error': 3,          // Server having issues
    'default': 5                // Default for unknown reasons
  };

  constructor() {
    this.setupAppStateListener();
    this.setupBackgroundFetch();
    this.setupNetworkStateListener();
    
    // Initialize with auth state token
    const authState = store.getState().auth;
    this.currentToken = authState.token;
    
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

  private getMaxRetries(reason: string): number {
    return this.MAX_RETRIES[reason as keyof typeof this.MAX_RETRIES] || this.MAX_RETRIES.default;
  }

  private getDisconnectReason(socket: Socket | null): string {
    if (!socket) return 'unknown';
    
    // Check for explicit disconnect reason from socket.io
    if (socket.disconnected) {
      const engineTransport = (socket as any).io?.engine;
      if (engineTransport?.transport?.name === 'websocket' && !engineTransport.connected) {
        return 'transport error';
      }
    }
    
    return 'unknown';
  }

  private log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[Socket][${timestamp}] ${message}`, data ? data : '');
  }

  private async handleReconnect() {
    if (this.isConnecting) {
      return;
    }

    const networkState = store.getState().network;
    const isNetworkAvailable = networkState.isConnected && networkState.isInternetReachable;
    const disconnectReason = this.getDisconnectReason(this._socket);
    const maxRetries = this.getMaxRetries(disconnectReason);

    if (!isNetworkAvailable) {
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = null;
      }
      return;
    }

    if (this.retryCount >= maxRetries) {
      console.log('[Socket] Max retries reached for reason:', disconnectReason);
      store.dispatch(setConnectionStatus({
        status: 'error',
        error: new Error(`Max retries (${maxRetries}) reached for ${disconnectReason}`),
        isReconnecting: false
      }));
      return;
    }

    if (!this.currentToken) {
      console.log('[Socket] No token available for reconnection');
      return;
    }

    const token = this.currentToken; // Store token in closure to ensure it's available
    this.retryCount++;
    
    const baseDelay = Math.min(
      this.INITIAL_RETRY_DELAY * Math.pow(2, this.retryCount - 1),
      this.MAX_RETRY_DELAY
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    store.dispatch(setConnectionStatus({
      status: 'connecting',
      isReconnecting: false
    }));

    this.retryTimeout = setTimeout(async () => {
      try {
        const currentNetworkState = (store.getState() as RootState).network;
        const isStillAvailable = currentNetworkState.isConnected && currentNetworkState.isInternetReachable;

        if (!isStillAvailable) {
          return;
        }
        await this.connect(token);
      } catch (error) {
        console.error('[Socket] Reconnection attempt failed:', error);
        const currentNetworkState = (store.getState() as RootState).network;
        if (currentNetworkState.isConnected) {
          this.handleReconnect();
        }
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

  private cleanupForReconnect() {
    this._isReconnecting = true;  // Set flag before cleanup
    this.cleanup(false);  // Do partial cleanup
    this._isReconnecting = false;  // Reset flag after cleanup
  }

  async connect(token: string) {
    if (this.isConnecting) {
      return;
    }

    try {
      this.isConnecting = true;
      this.currentToken = token;

      const networkState = store.getState().network;
      const isNetworkAvailable = networkState.isConnected && networkState.isInternetReachable;

      if (!isNetworkAvailable) {
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

      if (this._socket) {
        this.cleanupForReconnect();  // Use soft cleanup here
      }

      const isWebSocketAvailable = await this.checkWebSocketAvailability();

      if (!isWebSocketAvailable) {
        console.log('[Socket] WebSocket endpoint unavailable, will retry later');
        store.dispatch(setConnectionStatus({
          status: 'error',
          error: new Error('WebSocket endpoint not available'),
          isReconnecting: false
        }));
        await this.handleReconnect();
        return;
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
        
        // Immediately update connection status to prevent reconnection attempts
        store.dispatch(setConnectionStatus({
          status: 'connected',
          isReconnecting: false,
          lastConnected: new Date().toISOString()
        }));
        
        this.retryCount = 0;
        this.lastPingTime = Date.now();
        this._isConnected = true;
        this.isConnecting = false;  // Reset connecting flag
        
        // Re-join all previously subscribed lists
        const listsToJoin = new Set([...this.subscribedLists, ...this.pendingJoins]);
        if (listsToJoin.size > 0) {
          // Clear existing subscriptions since we're re-establishing them
          this.subscribedLists.clear();
          this.pendingJoins.clear();
          
          // Re-join each list
          listsToJoin.forEach(listId => {
            this.joinList(listId);
          });
        }
      });

      this._socket.on('disconnect', (reason: string) => {
        const disconnectReason = reason || this.getDisconnectReason(this._socket);
        this._isConnected = false;
        
        if (disconnectReason === 'io server disconnect' || disconnectReason === 'io client disconnect') {
          store.dispatch(setConnectionStatus({
            status: 'disconnected',
            isReconnecting: false
          }));
          return;
        }
        
        store.dispatch(setConnectionStatus({
          status: 'disconnected',
          isReconnecting: true,
          error: new Error(disconnectReason)
        }));
        this.handleReconnect();
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
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(isFullCleanup: boolean = true) {
    this.cleanup(isFullCleanup);
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

    // Add list operation event listeners
    this._socket.on('listJoined', (data: { listId: string }) => {});

    this._socket.on('listLeft', (data: { listId: string }) => {});

    this._socket.on('listJoinError', (data: { listId: string, error: string }) => {
      // Cleanup failed subscription
      this.subscribedLists.delete(data.listId);
    });

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

    this._socket.on('disconnect', (reason: string) => {
      const disconnectReason = reason || this.getDisconnectReason(this._socket);
      this._isConnected = false;
      
      if (disconnectReason === 'io server disconnect' || disconnectReason === 'io client disconnect') {
        store.dispatch(setConnectionStatus({
          status: 'disconnected',
          isReconnecting: false
        }));
        return;
      }
      
      store.dispatch(setConnectionStatus({
        status: 'disconnected',
        isReconnecting: true,
        error: new Error(disconnectReason)
      }));
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

    this._socket.on('listUpdated', (data: { type: string; listId: string; data: any; items?: any[]; item?: any; itemId?: string; updatedBy: any }) => {
      if (!data.listId) {
        console.error('[Socket] Invalid listUpdated event: missing listId');
        return;
      }

      if (!this.subscribedLists.has(data.listId)) {
        return;
      }

      // Get current list from store
      const currentState = store.getState();
      const currentList = currentState.lists.lists.find(list => list._id === data.listId);
      
      if (!currentList) {
        console.error('[Socket] List not found in store:', data.listId);
        return;
      }

      // Create a new list object based on the update type
      let updatedList;
      
      switch (data.type) {
        case 'items_added':
          if (!Array.isArray(data.items)) {
            console.error('[Socket] Invalid items_added event: items not an array');
            return;
          }
          updatedList = {
            ...currentList,
            items: [...currentList.items, ...data.items]
          };
          break;

        case 'item_updated':
          if (!data.item || !data.item._id) {
            console.error('[Socket] Invalid item_updated event: missing item data');
            return;
          }
          updatedList = {
            ...currentList,
            items: currentList.items.map(item => 
              item._id === data.item._id ? data.item : item
            )
          };
          break;

        case 'item_deleted':
          if (!data.itemId) {
            console.error('[Socket] Invalid item_deleted event: missing itemId');
            return;
          }
          updatedList = {
            ...currentList,
            items: currentList.items.filter(item => item._id !== data.itemId)
          };
          break;

        case 'items_reordered':
          if (!Array.isArray(data.items)) {
            console.error('[Socket] Invalid items_reordered event: items not an array');
            return;
          }
          updatedList = {
            ...currentList,
            items: data.items
          };
          break;

        case 'list_updated':
          if (!data.data) {
            console.error('[Socket] Invalid list_updated event: missing data');
            return;
          }
          updatedList = data.data;
          break;

        default:
          console.error('[Socket] Unknown update type:', data.type);
          return;
      }

      store.dispatch(updateListInStore(updatedList));
    });

    this._socket.on('pong', () => {
      this.lastPingTime = Date.now();
    });
  }

  // Add method to check if connected to a specific list
  isSubscribedToList(listId: string): boolean {
    const status = {
      isSubscribed: this.subscribedLists.has(listId),
      isPending: this.pendingJoins.has(listId),
      socketConnected: this._socket?.connected
    };
        
    return status.isSubscribed;
  }

  private setupNetworkStateListener() {
    store.subscribe(() => {
      const state = store.getState();
      const networkState = state.network;
      const connectionState = state.connection;
      const networkChanged = 
        this.lastNetworkState.isConnected !== networkState.isConnected ||
        this.lastNetworkState.isInternetReachable !== networkState.isInternetReachable;

      if (networkChanged) {
        // Update last known state
        this.lastNetworkState = {
          isConnected: networkState.isConnected,
          isInternetReachable: networkState.isInternetReachable
        };

        // Only attempt reconnection if:
        // 1. Network is available
        // 2. We have a valid token
        // 3. Socket is not connected OR we're in a non-connected state
        // 4. We're not already connecting
        // 5. We're not in the middle of a cleanup
        if (networkState.isConnected && 
            networkState.isInternetReachable && 
            this.currentToken &&
            !this._socket?.connected &&  // Check actual socket state
            connectionState.status !== 'connected' &&  // Check Redux state
            !this.isConnecting &&  // Prevent duplicate connection attempts
            !this._isReconnecting) {  // Prevent reconnection during cleanup
          this.handleReconnect();
        }
      }
    });
  }

  cleanup(isFullCleanup: boolean = true) {
    this._isReconnecting = true;  // Set flag before cleanup
    
    // Clear all timeouts and intervals
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // Clear state based on cleanup type
    this._isConnected = false;
    this.isConnecting = false;
    this.lastPingTime = 0;

    if (isFullCleanup) {
      // Only clear subscriptions and token on full cleanup
      this.subscribedLists.clear();
      this.pendingJoins.clear();
      this.recentNotifications.clear();
      this.currentToken = null;
      this.retryCount = 0;
    }

    // Disconnect socket if exists
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }

    // Reset network state
    this.lastNetworkState = {
      isConnected: true,
      isInternetReachable: null
    };

    store.dispatch(setConnectionStatus({
      status: 'disconnected',
      isReconnecting: false
    }));
    
    this._isReconnecting = false;  // Reset flag after cleanup
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