import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { userService } from './user';

// Create a separate axios instance for auth operations only
const authApi = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: API_CONFIG.HEADERS,
});

export const authService = {
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(API_CONFIG.TOKEN_KEY);
    } catch (error) {
      console.error('[Auth Service] Error getting token:', error);
      return null;
    }
  },

  async setToken(token: string | null): Promise<void> {
    try {
      if (token) {
        await AsyncStorage.setItem(API_CONFIG.TOKEN_KEY, token);
      } else {
        await AsyncStorage.removeItem(API_CONFIG.TOKEN_KEY);
      }
    } catch (error) {
      console.error('[Auth Service] Error setting token:', error);
    }
  },

  async login(email: string, password: string) {
    try {
      const response = await authApi.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, { email, password });
      const data = response.data;
      await this.setToken(data.token);
      return data;
    } catch (error: any) {
      console.error('[Auth Service] Login error:', error.response?.data || error.message);
      throw error;
    }
  },

  async register(name: string, email: string, password: string) {
    try {
      const response = await authApi.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, { name, email, password });
      const data = response.data;
      await this.setToken(data.token);
      return data;
    } catch (error: any) {
      console.error('[Auth Service] Registration error:', error.response?.data || error.message);
      throw error;
    }
  },

  async logout(): Promise<void> {
    await this.setToken(null);
  },

  async validateSession() {
    try {
      const token = await this.getStoredToken();
      if (!token) {
        throw new Error('No token found');
      }
      
      const user = await userService.getProfile();
      return { user, token };
    } catch (error: any) {
      throw error;
    }
  }
}; 