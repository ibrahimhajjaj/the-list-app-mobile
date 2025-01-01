import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import syncService from '../../services/sync';

interface NetworkState {
  isConnected: boolean;
  type: string | null;
  isInternetReachable: boolean | null;
  lastChecked: number | null;
  details: NetInfoState | null;
  lastConnectionRestored: number | null;
}

const initialState: NetworkState = {
  isConnected: true,
  type: null,
  isInternetReachable: null,
  lastChecked: null,
  details: null,
  lastConnectionRestored: null
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNetworkState: (state, action: PayloadAction<NetInfoState>) => {
      const wasDisconnected = !state.isConnected || !state.isInternetReachable;
      const isNowConnected = action.payload.isConnected && action.payload.isInternetReachable;

      state.isConnected = action.payload.isConnected ?? false;
      state.type = action.payload.type;
      state.isInternetReachable = action.payload.isInternetReachable;
      state.lastChecked = Date.now();
      state.details = action.payload;

      // If connection was restored, update lastConnectionRestored
      if (wasDisconnected && isNowConnected) {
        state.lastConnectionRestored = Date.now();
        // Trigger immediate sync
        syncService.processPendingChanges();
      }
    },
    resetNetworkState: (state) => {
      state.isConnected = true;
      state.type = null;
      state.isInternetReachable = null;
      state.lastChecked = null;
      state.details = null;
      state.lastConnectionRestored = null;
    }
  }
});

export const { setNetworkState, resetNetworkState } = networkSlice.actions;
export default networkSlice.reducer;

// Thunk to initialize network monitoring
export const initializeNetworkMonitoring = () => (dispatch: any) => {
  // Set up network state listener
  NetInfo.addEventListener(state => {
    dispatch(setNetworkState(state));
  });

  // Get initial state
  NetInfo.fetch().then(state => {
    dispatch(setNetworkState(state));
  });
}; 