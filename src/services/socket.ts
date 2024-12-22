import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { updateList } from '../store/slices/listSlice';
import { List } from '../store/slices/listSlice';
import { API_URL } from '../config';

class SocketService {
  private socket: Socket | null = null;
  private subscribedLists: Set<string> = new Set();

  connect(token: string) {
    if (this.socket?.connected) return;

    console.log('Connecting to WebSocket...');
    this.socket = io(API_URL, {
      transports: ['websocket'],
      auth: { token },
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      // Rejoin all previously subscribed lists
      this.subscribedLists.forEach(listId => this.joinList(listId));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.socket.on('listUpdated', (data: { type: string; listId: string; data: List }) => {
      console.log('Received list update:', data);
      store.dispatch(updateList(data.data));
    });

    this.socket.on('joinedList', (data) => {
      console.log('Successfully joined list room:', data);
    });

    this.socket.on('leftList', (data) => {
      console.log('Successfully left list room:', data);
    });
  }

  joinList(listId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Cannot join list:', listId);
      return;
    }

    console.log('Joining list room:', listId);
    this.socket.emit('joinList', listId);
    this.subscribedLists.add(listId);
  }

  leaveList(listId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected. Cannot leave list:', listId);
      return;
    }

    console.log('Leaving list room:', listId);
    this.socket.emit('leaveList', listId);
    this.subscribedLists.delete(listId);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribedLists.clear();
    }
  }
}

export const socketService = new SocketService();
export default socketService; 