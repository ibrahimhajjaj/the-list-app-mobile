import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/auth';
import { userService } from '../../services/user';
import type { store } from '../index';
import { notificationService } from '../../services/notificationService';

type AppState = ReturnType<typeof store.getState>;

interface User {
  _id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  lastAttempt: {
    action: string;
    timestamp: number;
    details?: any;
  } | null;
  isAuthenticated: boolean;
  isOffline: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  lastAttempt: null,
  isAuthenticated: false,
  isOffline: false
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await authService.login(email, password);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async ({ name, email, password }: { name: string; email: string; password: string }, { rejectWithValue }) => {
    try {
      console.log('Starting registration process for:', email);
      const data = await authService.register(name, email, password);
      console.log('Registration successful:', data);
      return data;
    } catch (error: any) {
      console.error('Registration thunk error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      return rejectWithValue({
        message: error.response?.data?.error || 'Registration failed',
        status: error.response?.status,
        details: error.response?.data,
      });
    }
  }
);

export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue, getState }) => {
    try {
      // Get network status from Redux store
      const state = getState() as AppState;
      const networkState = state.network;
      const isOnline = networkState.isConnected && networkState.isInternetReachable === true;

      const result = await authService.validateSession(isOnline);
      
      if (!result.user || !result.token) {
        throw new Error('Invalid session data');
      }

      return {
        ...result,
        isOffline: !isOnline
      };
    } catch (error: any) {
      // Get current network state from Redux
      const state = getState() as AppState;
      const networkState = state.network;
      const isOffline = !networkState.isConnected || networkState.isInternetReachable !== true;
      return rejectWithValue({
        message: error.message,
        isOffline
      });
    }
  }
);

export const updateUser = createAsyncThunk(
  'auth/updateUser',
  async (data: { name?: string; email?: string; password?: string }, { rejectWithValue }) => {
    try {
      const user = await userService.updateProfile(data);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Update failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      state.loading = false;
      state.isAuthenticated = false;
      state.isOffline = false;
      authService.logout();
    },
    clearError: (state) => {
      state.error = null;
    },
    setOfflineState: (state, action) => {
      state.isOffline = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        state.isAuthenticated = true;
        state.isOffline = false;
        // Register for push notifications after successful login
        notificationService.registerForPushNotifications().catch(error => {
          console.error('[Auth] Failed to register for push notifications:', error);
        });
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        console.log('[Auth Slice] Registration attempt started');
        state.loading = true;
        state.error = null;
        state.lastAttempt = {
          action: 'register',
          timestamp: Date.now(),
        };
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        state.isAuthenticated = true;
        state.isOffline = false;
        state.lastAttempt = {
          action: 'register',
          timestamp: Date.now(),
          details: { success: true },
        };
        // Register for push notifications after successful registration
        notificationService.registerForPushNotifications().catch(error => {
          console.error('[Auth] Failed to register for push notifications:', error);
        });
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload as any;
        state.error = payload?.message || 'Registration failed';
        state.isAuthenticated = false;
        state.lastAttempt = {
          action: 'register',
          timestamp: Date.now(),
          details: {
            success: false,
            error: payload?.message,
            status: payload?.status,
            details: payload?.details,
          },
        };
      })
      // Load User
      .addCase(loadUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.error = null;
        state.isAuthenticated = true;
        state.isOffline = action.payload.isOffline || false;
      })
      .addCase(loadUser.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload as any;
        state.error = payload?.message;
        state.isOffline = payload?.isOffline;
        
        // Only clear auth state if we're online and got an error
        if (!state.isOffline) {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
        }
      })
      // Update User
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        console.log('[Auth Slice] User profile updated successfully');
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { logout, clearError, setOfflineState } = authSlice.actions;
export default authSlice.reducer; 