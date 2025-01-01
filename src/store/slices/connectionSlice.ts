import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppStateStatus } from 'react-native';

export type ConnectionStatus = 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error?: Error | null;
  isReconnecting: boolean;
  lastConnected?: string | null;
  appState: AppStateStatus;
}

const initialState: ConnectionState = {
  status: 'initializing',
  error: null,
  isReconnecting: false,
  lastConnected: null,
  appState: 'active'
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<{
      status: ConnectionStatus;
      error?: Error;
      isReconnecting?: boolean;
      lastConnected?: string;
    }>) => {
      const { status, error, isReconnecting, lastConnected } = action.payload;
      state.status = status;
      state.error = error || null;
      state.isReconnecting = isReconnecting || false;
      if (lastConnected) state.lastConnected = lastConnected;
    },
    setAppState: (state, action: PayloadAction<AppStateStatus>) => {
      state.appState = action.payload;
    },
    resetConnectionState: (state) => {
      state.status = 'disconnected';
      state.error = null;
      state.isReconnecting = false;
    }
  }
});

export const { 
  setConnectionStatus, 
  setAppState, 
  resetConnectionState 
} = connectionSlice.actions;

// Selectors
export const selectConnectionState = (state: { connection: ConnectionState }) => state.connection;
export const selectIsConnected = (state: { connection: ConnectionState }) => 
  state.connection.status === 'connected';
export const selectIsReconnecting = (state: { connection: ConnectionState }) => 
  state.connection.isReconnecting;

export default connectionSlice.reducer; 