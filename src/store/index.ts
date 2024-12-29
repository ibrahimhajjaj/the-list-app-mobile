import { configureStore } from '@reduxjs/toolkit';
import authReducer, { logout, clearError } from './slices/authSlice';
import listReducer from './slices/listSlice';
import settingsReducer from './slices/settingsSlice';
import networkReducer, { 
  setNetworkState, 
  resetNetworkState, 
  initializeNetworkMonitoring 
} from './slices/networkSlice';
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
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['network/setNetworkState'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.details'],
        // Ignore these paths in the state
        ignoredPaths: ['network.details'],
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
}; 