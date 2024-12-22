import { configureStore } from '@reduxjs/toolkit';
import listsReducer from './slices/listSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    lists: listsReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 