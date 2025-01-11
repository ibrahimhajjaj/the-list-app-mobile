import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SocketState {
  isInitialized: boolean;
  isConnected: boolean;
  socketId: string | null;
  lastError: string | null;
  reconnectAttempts: number;
}

const initialState: SocketState = {
  isInitialized: false,
  isConnected: false,
  socketId: null,
  lastError: null,
  reconnectAttempts: 0,
};

const socketSlice = createSlice({
  name: 'socket',
  initialState,
  reducers: {
    socketInitialized: (state, action: PayloadAction<{ socketId: string }>) => {
      state.isInitialized = true;
      state.socketId = action.payload.socketId;
      state.lastError = null;
      state.reconnectAttempts = 0;
    },
    socketConnected: (state, action: PayloadAction<{ socketId: string }>) => {
      state.isConnected = true;
      state.socketId = action.payload.socketId;
      state.lastError = null;
    },
    socketDisconnected: (state, action: PayloadAction<{ reason: string }>) => {
      state.isConnected = false;
      state.lastError = action.payload.reason;
    },
    socketError: (state, action: PayloadAction<{ error: string }>) => {
      state.lastError = action.payload.error;
      state.reconnectAttempts += 1;
    },
    socketReset: (state) => {
      state.isInitialized = false;
      state.isConnected = false;
      state.socketId = null;
      state.lastError = null;
      state.reconnectAttempts = 0;
    },
  },
});

export const {
  socketInitialized,
  socketConnected,
  socketDisconnected,
  socketError,
  socketReset,
} = socketSlice.actions;

export default socketSlice.reducer; 