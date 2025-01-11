import { configureStore } from '@reduxjs/toolkit';
import authReducer, { logout, clearError } from './slices/authSlice';
import listReducer from './slices/listSlice';
import settingsReducer from './slices/settingsSlice';
import networkReducer, { 
  setNetworkState, 
  resetNetworkState, 
  initializeNetworkMonitoring 
} from './slices/networkSlice';
import connectionReducer, {
  setConnectionStatus,
  setAppState,
  resetConnectionState,
  selectConnectionState,
  selectIsConnected,
  selectIsReconnecting
} from './slices/connectionSlice';
import { 
  setLists, 
  setCurrentList, 
  addList, 
  updateListInStore, 
  setLoading, 
  setError 
} from './actions/listActionCreators';
import { syncMiddleware } from './middleware/syncMiddleware';

// Configure store
const store = configureStore({
  reducer: {
    auth: authReducer,
    lists: listReducer,
    settings: settingsReducer,
    network: networkReducer,
    connection: connectionReducer,
  },
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'network/setNetworkState', 
          'connection/setConnectionStatus',
          'sync/syncFailed'
        ],
        ignoredActionPaths: ['payload.details', 'payload.error'],
        ignoredPaths: ['network.details', 'connection.error'],
      },
    }).concat(syncMiddleware);
  },
});

// Export store and types
export { store };
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Re-export actions and selectors
export {
  // Network actions
  setNetworkState,
  resetNetworkState,
  initializeNetworkMonitoring,
  
  // Auth actions
  logout,
  clearError,
  
  // List actions
  setLists,
  setCurrentList,
  addList,
  updateListInStore,
  setLoading,
  setError,

  // Connection actions and selectors
  setConnectionStatus,
  setAppState,
  resetConnectionState,
  selectConnectionState,
  selectIsConnected,
  selectIsReconnecting,
}; 