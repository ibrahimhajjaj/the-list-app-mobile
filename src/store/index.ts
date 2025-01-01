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

// Configure store
export const store = configureStore({
  reducer: {
    auth: authReducer,
    lists: listReducer,
    settings: settingsReducer,
    network: networkReducer,
    connection: connectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['network/setNetworkState', 'connection/setConnectionStatus'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.details', 'payload.error'],
        // Ignore these paths in the state
        ignoredPaths: ['network.details', 'connection.error'],
      },
    }),
});

// Infer types from store
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