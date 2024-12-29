import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config';
import * as Notifications from 'expo-notifications';
import { store } from '../store/store';
import { authService } from './auth';
import { updateListInStore } from '../store/actions/listActionCreators';
import { shouldShowNotification } from '../store/slices/settingsSlice';

class SocketService {
  private _socket: Socket | null = null;
  private subscribedLists: Set<string> = new Set();
  private pendingJoins: Set<string> = new Set();
  private notificationsInitialized: boolean = false;
  private recentNotifications: Set<string> = new Set();
  private cleanupTimeout: NodeJS.Timeout | null = null;
  private _isConnected: boolean = false;
  private _isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private currentToken: string | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;
  private readonly PING_INTERVAL = 25000; // 25 seconds
  private readonly PING_TIMEOUT = 5000;   // 5 seconds

  get socket(): Socket | null {
    return this._socket;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isReconnecting(): boolean {
    return this._isReconnecting;
  }

  private resetReconnectAttempts() {
    this.reconnectAttempts = 0;
    this._isReconnecting = false;
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      await authService.validateSession();
      return true;
    } catch (error) {
      console.error('[SocketService] Token validation failed:', error);
      return false;
    }
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Socket] Max reconnection attempts reached');
      this._isReconnecting = false;
      return;
    }

    this._isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    await new Promise(resolve => setTimeout(resolve, delay));

    if (this.currentToken) {
      await this.connect(this.currentToken);
    } else {
      this._isReconnecting = false;
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
        console.warn('[SocketService] Health check failed, connection might be stale');
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
      const isValid = await this.validateToken(token);
      
      if (!isValid) {
        this._isReconnecting = false;
        return;
      }

      if (this._socket) {
        this.disconnect();
      }

      this._socket = io(WS_URL, {
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        forceNew: true,
        timeout: 10000,
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
      this._isConnected = false;
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
      this.currentToken = null;
      this.subscribedLists.clear();
      this.pendingJoins.clear();
      this.resetReconnectAttempts();

      if (this.cleanupTimeout) {
        clearInterval(this.cleanupTimeout);
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

  private async initializeNotifications() {
    if (this.notificationsInitialized) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('[SocketService] edited Failed to get push notification permissions');
        return;
      }

      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      this.notificationsInitialized = true;
    } catch (error) {
      console.error('[SocketService] Error initializing notifications:', error);
    }
  }

  private cleanupOldNotifications() {
    // Clear notifications older than 5 seconds
    this.recentNotifications.clear();
  }

  private setupEventListeners() {
    if (!this._socket) {
      console.warn('[SocketService] Cannot setup listeners: socket not initialized');
      return;
    }

    this._socket.on('connect', () => {
      console.log('[SocketService] Connected successfully', {
        socketId: this._socket?.id,
        reconnectAttempts: this.reconnectAttempts,
        timestamp: new Date().toISOString()
      });
      
      this._isConnected = true;
      this.resetReconnectAttempts();
      this.lastPingTime = Date.now();
      
      if (this.pendingJoins.size > 0) {
        console.log('[SocketService] Processing pending room joins:', Array.from(this.pendingJoins));
        this.pendingJoins.forEach(listId => {
          this.joinList(listId);
        });
        this.pendingJoins.clear();
      }
    });

    this._socket.on('connect_error', (error: Error & { data?: any; description?: string }) => {
      console.error('[SocketService] Connection error:', {
        message: error.message,
        data: error.data,
        description: error.description
      });
      this._isConnected = false;
      this.handleReconnect();
    });

    this._socket.on('disconnect', (reason) => {
      console.log('[SocketService] Disconnected:', {
        reason,
        wasConnected: this._isConnected,
        subscribedRooms: Array.from(this.subscribedLists)
      });
      
      this._isConnected = false;
      
      // Save current rooms for reconnection
      this.subscribedLists.forEach(listId => this.pendingJoins.add(listId));
      
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        console.log('[SocketService] Intentional disconnect, not attempting reconnection');
        return;
      }
      
      this.handleReconnect();
    });

    this._socket.on('error', (error) => {
      console.error('[SocketService] Socket error:', {
        error,
        socketId: this._socket?.id,
        isConnected: this._isConnected
      });
    });

    this._socket.on('notification', async (data: { type: string; data: any }) => {
      if (data.type === 'new_notification' && this.notificationsInitialized) {
        // Create a unique key for this notification
        const notificationKey = `${data.data._id}-${data.data.createdAt}`;
        
        // Check if we've recently handled this notification
        if (this.recentNotifications.has(notificationKey)) {
          return;
        }
        
        // Add to recent notifications
        this.recentNotifications.add(notificationKey);

        // Determine notification type
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
          type = 'item_edit'; // default case
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
              trigger: null, // Show immediately
            });
          } catch (error) {
            console.error('[SocketService] Error scheduling notification:', error);
          }
        }
      }
    });

    this._socket.on('listUpdated', (data: { type: string; listId: string; data: any; updatedBy: any; changes: any }) => {
      // Only update if we're subscribed to this list
      if (this.subscribedLists.has(data.listId)) {
        store.dispatch(updateListInStore(data.data));
      }
    });

    this._socket.on('joinedList', (data) => {
      // Room join confirmation received
      console.log('[SocketService] Room join confirmed:', {
        listId: data.listId,
        socketId: this._socket?.id,
        timestamp: new Date().toISOString()
      });
    });

    this._socket.on('leftList', (data) => {
      // Room leave confirmation received
      console.log('[SocketService] Room leave confirmed:', {
        listId: data.listId,
        socketId: this._socket?.id,
        timestamp: new Date().toISOString()
      });
    });

    // Add pong handler
    this._socket.on('pong', () => {
      this.lastPingTime = Date.now();
    });
  }

  // Add method to check if connected to a specific list
  isSubscribedToList(listId: string): boolean {
    return this.subscribedLists.has(listId);
  }
}

export const socketService = new SocketService();
export default socketService; 