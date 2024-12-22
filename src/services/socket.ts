import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001/api';
const SOCKET_URL = API_URL.replace('/api', '');

class SocketService {
  private socket: Socket | null = null;
  private listRooms: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect() {
    if (this.socket?.connected) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token available for socket connection');
        return;
      }

      console.log('Connecting to socket server:', SOCKET_URL);
      
      this.socket = io(SOCKET_URL, {
        auth: {
          token,
        },
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['websocket'],
      });

      this.setupEventListeners();
      this.socket.connect();
    } catch (error) {
      console.error('Error initializing socket connection:', error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.reconnectAttempts = 0;
      // Rejoin all list rooms after reconnection
      this.listRooms.forEach(listId => {
        this.joinList(listId);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error('Socket connection error:', {
        error: error.message,
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      });

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached, stopping reconnection');
        this.socket?.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.listRooms.clear();
      this.reconnectAttempts = 0;
    }
  }

  joinList(listId: string) {
    if (!this.socket?.connected) {
      console.warn('Cannot join list: socket not connected');
      return;
    }
    console.log('Joining list room:', listId);
    this.socket.emit('joinList', listId);
    this.listRooms.add(listId);
  }

  leaveList(listId: string) {
    if (!this.socket?.connected) {
      console.warn('Cannot leave list: socket not connected');
      return;
    }
    console.log('Leaving list room:', listId);
    this.socket.emit('leaveList', listId);
    this.listRooms.delete(listId);
  }

  onListUpdated(callback: (data: any) => void) {
    if (!this.socket) {
      console.warn('Cannot listen for updates: socket not initialized');
      return;
    }
    this.socket.on('listUpdated', callback);
  }

  offListUpdated(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.off('listUpdated', callback);
  }

  emitListUpdate(listId: string, update: any) {
    if (!this.socket?.connected) {
      console.warn('Cannot emit update: socket not connected');
      return;
    }
    console.log('Emitting list update:', { listId, update });
    this.socket.emit('listUpdate', { listId, update });
  }
}

export const socketService = new SocketService();
export default socketService; 