import { configureStore } from '@reduxjs/toolkit';
import authReducer, { logout, clearError } from './slices/authSlice';
import listReducer from './slices/listSlice';
import settingsReducer from './slices/settingsSlice';
import networkReducer, { 
  setNetworkState, 
  resetNetworkState, 
  initializeNetworkMonitoring 
} from './slices/networkSlice';
import appStateReducer, {
  setAppState,
  resetAppState,
  selectAppState,
  selectIsAppActive
} from './slices/appStateSlice';
import socketReducer, {
  socketInitialized,
  socketConnected,
  socketDisconnected,
  socketError,
  socketReset
} from './slices/socketSlice';
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
    appState: appStateReducer,
    socket: socketReducer
  },
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'network/setNetworkState', 
          'socket/socketError',
          'sync/syncFailed'
        ],
        ignoredActionPaths: ['payload.details', 'payload.error'],
        ignoredPaths: ['network.details', 'socket.error'],
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

  // App State actions and selectors
  setAppState,
  resetAppState,
  selectAppState,
  selectIsAppActive,

  // Socket actions
  socketInitialized,
  socketConnected,
  socketDisconnected,
  socketError,
  socketReset,
}; 