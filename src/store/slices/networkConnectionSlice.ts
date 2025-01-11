import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppStateStatus } from 'react-native';

export interface AppState {
  appState: AppStateStatus;
  lastActiveTimestamp: string | null;
}

const initialState: AppState = {
  appState: 'active',
  lastActiveTimestamp: null
};

const appStateSlice = createSlice({
  name: 'appState',
  initialState,
  reducers: {
    setAppState: (state, action: PayloadAction<AppStateStatus>) => {
      state.appState = action.payload;
      if (action.payload === 'active') {
        state.lastActiveTimestamp = new Date().toISOString();
      }
    },
    resetAppState: (state) => {
      state.appState = 'active';
      state.lastActiveTimestamp = null;
    }
  }
});

export const { 
  setAppState, 
  resetAppState 
} = appStateSlice.actions;

// Selectors
export const selectAppState = (state: { appState: AppState }) => state.appState;
export const selectIsAppActive = (state: { appState: AppState }) => 
  state.appState.appState === 'active';

export default appStateSlice.reducer; 