import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import listReducer from './slices/listSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    lists: listReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 