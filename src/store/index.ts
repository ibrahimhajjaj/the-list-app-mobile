import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import listsReducer from './slices/listSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    lists: listsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store; 