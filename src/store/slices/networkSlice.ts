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

      console.log('[Network] State change:', {
        wasDisconnected,
        isNowConnected,
        previousState: {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type
        },
        newState: {
          isConnected: action.payload.isConnected,
          isInternetReachable: action.payload.isInternetReachable,
          type: action.payload.type
        }
      });

      state.isConnected = action.payload.isConnected ?? false;
      state.type = action.payload.type;
      state.isInternetReachable = action.payload.isInternetReachable;
      state.lastChecked = Date.now();
      state.details = action.payload;

      // If connection was restored, update lastConnectionRestored
      if (wasDisconnected && isNowConnected) {
        console.log('[Network] Connection restored, triggering sync');
        state.lastConnectionRestored = Date.now();
        // Trigger immediate sync
        syncService.processPendingChanges();
      }
    },
    resetNetworkState: (state) => {
      console.log('[Network] Resetting network state');
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
  console.log('[Network] Initializing network monitoring');
  // Set up network state listener
  NetInfo.addEventListener(state => {
    console.log('[Network] Network state update from listener:', state);
    dispatch(setNetworkState(state));
  });

  // Get initial state
  NetInfo.fetch().then(state => {
    console.log('[Network] Initial network state:', state);
    dispatch(setNetworkState(state));
  });
}; 