import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { updateList } from '../store/slices/listSlice';
import { WS_URL } from '../config';
import { shouldShowNotification } from '../store/slices/settingsSlice';
import * as Notifications from 'expo-notifications';

class SocketService {
  private _socket: Socket | null = null;
  private subscribedLists: Set<string> = new Set();
  private pendingJoins: Set<string> = new Set();
  private notificationsInitialized: boolean = false;
  private recentNotifications: Set<string> = new Set(); // Track recent notifications
  private cleanupTimeout: NodeJS.Timeout | null = null;

  // Expose socket as read-only
  get socket(): Socket | null {
    return this._socket;
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
        console.warn('[SocketService] Failed to get push notification permissions');
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
      console.log('[SocketService] Notifications initialized successfully');
    } catch (error) {
      console.error('[SocketService] Error initializing notifications:', error);
    }
  }

  private cleanupOldNotifications() {
    // Clear notifications older than 5 seconds
    this.recentNotifications.clear();
  }

  async connect(token: string) {
    // Disconnect existing socket if any
    if (this._socket) {
      console.log('[SocketService] Cleaning up existing connection');
      this.disconnect();
    }

    console.log('[SocketService] Connecting to WebSocket at:', WS_URL);
    this._socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true, // Force a new connection
    });

    // Initialize notifications before connecting
    await this.initializeNotifications();

    this.setupEventListeners();

    // Setup cleanup interval
    if (this.cleanupTimeout) {
      clearInterval(this.cleanupTimeout);
    }
    this.cleanupTimeout = setInterval(() => this.cleanupOldNotifications(), 5000);
  }

  private setupEventListeners() {
    if (!this._socket) {
      console.warn('[SocketService] Cannot setup listeners: socket is null');
      return;
    }

    this._socket.on('connect', () => {
      console.log('[SocketService] WebSocket connected, socket id:', this._socket?.id);
      
      // Join any pending rooms after connection
      if (this.pendingJoins.size > 0) {
        console.log('[SocketService] Processing pending room joins:', Array.from(this.pendingJoins));
        this.pendingJoins.forEach(listId => {
          this.joinList(listId);
        });
        this.pendingJoins.clear();
      }
    });

    this._socket.on('connect_error', (error) => {
      console.error('[SocketService] Connection error:', error.message);
    });

    this._socket.on('disconnect', (reason) => {
      console.log('[SocketService] WebSocket disconnected. Reason:', reason);
      // Add current subscriptions to pending joins for reconnection
      this.subscribedLists.forEach(listId => this.pendingJoins.add(listId));
      console.log('[SocketService] Added to pending joins:', Array.from(this.pendingJoins));
    });

    this._socket.on('error', (error) => {
      console.error('[SocketService] WebSocket error:', error);
    });

    this._socket.on('notification', async (data: { type: string; data: any }) => {
      console.log('[SocketService] Received notification:', data);
      
      if (data.type === 'new_notification' && this.notificationsInitialized) {
        // Create a unique key for this notification
        const notificationKey = `${data.data._id}-${data.data.createdAt}`;
        
        // Check if we've recently handled this notification
        if (this.recentNotifications.has(notificationKey)) {
          console.log('[SocketService] Duplicate notification suppressed:', notificationKey);
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
        console.log('[SocketService] Should show notification:', { type, shouldShow });

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
            console.log('[SocketService] Notification scheduled for:', notificationKey);
          } catch (error) {
            console.error('[SocketService] Error scheduling notification:', error);
          }
        } else {
          console.log('[SocketService] Notification suppressed due to settings');
        }
      }
    });

    this._socket.on('listUpdated', (data: { type: string; listId: string; data: any; updatedBy: any; changes: any }) => {
      console.log('[SocketService] Received list update event:', {
        type: data.type,
        listId: data.listId,
        updatedBy: data.updatedBy,
        isSubscribed: this.subscribedLists.has(data.listId),
        subscribedLists: Array.from(this.subscribedLists),
        changes: data.changes
      });

      // Only update if we're subscribed to this list
      if (this.subscribedLists.has(data.listId)) {
        store.dispatch(updateList(data.data));
        console.log('[SocketService] List update dispatched to Redux store');
      } else {
        console.log('[SocketService] Ignoring update for unsubscribed list:', data.listId);
      }
    });

    this._socket.on('joinedList', (data) => {
      console.log('[SocketService] Successfully joined list room:', {
        ...data,
        socketId: this._socket?.id,
        subscribedLists: Array.from(this.subscribedLists)
      });
    });

    this._socket.on('leftList', (data) => {
      console.log('[SocketService] Successfully left list room:', {
        ...data,
        socketId: this._socket?.id,
        subscribedLists: Array.from(this.subscribedLists)
      });
    });
  }

  disconnect() {
    if (this._socket) {
      console.log('[SocketService] Disconnecting WebSocket');
      this._socket.removeAllListeners();  // Remove all event listeners
      this._socket.disconnect();
      this._socket = null;
      this.subscribedLists.clear();
      this.pendingJoins.clear();
      
      // Clear cleanup interval
      if (this.cleanupTimeout) {
        clearInterval(this.cleanupTimeout);
        this.cleanupTimeout = null;
      }
      
      console.log('[SocketService] WebSocket disconnected and subscriptions cleared');
    }
  }

  joinList(listId: string) {
    if (!this._socket?.connected) {
      console.warn('[SocketService] Cannot join list:', listId, 'Socket not connected');
      this.pendingJoins.add(listId);
      console.log('[SocketService] Added to pending joins:', Array.from(this.pendingJoins));
      return;
    }

    console.log('[SocketService] Joining list room:', {
      listId,
      socketId: this._socket.id,
      currentSubscriptions: Array.from(this.subscribedLists)
    });

    this._socket.emit('joinList', listId);
    this.subscribedLists.add(listId);
    this.pendingJoins.delete(listId);

    console.log('[SocketService] Updated subscriptions after join:', Array.from(this.subscribedLists));
  }

  leaveList(listId: string) {
    if (!this._socket?.connected) {
      console.warn('[SocketService] Cannot leave list:', listId, 'Socket not connected');
      return;
    }

    console.log('[SocketService] Leaving list room:', {
      listId,
      socketId: this._socket.id,
      currentSubscriptions: Array.from(this.subscribedLists)
    });

    this._socket.emit('leaveList', listId);
    this.subscribedLists.delete(listId);
    this.pendingJoins.delete(listId);

    console.log('[SocketService] Updated subscriptions after leave:', Array.from(this.subscribedLists));
  }

  // Add method to check if connected to a specific list
  isSubscribedToList(listId: string): boolean {
    return this.subscribedLists.has(listId);
  }
}

export const socketService = new SocketService();
export default socketService; 