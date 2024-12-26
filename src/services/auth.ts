import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from './api';

const TOKEN_KEY = '@app:auth_token';

export const authService = {
  async getStoredToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.error('[Auth Service] Error getting token:', error);
      return null;
    }
  },

  async setToken(token: string | null): Promise<void> {
    try {
      if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
      console.error('[Auth Service] Error setting token:', error);
    }
  },

  async login(email: string, password: string) {
    const data = await api.login(email, password);
    await this.setToken(data.token);
    return data;
  },

  async register(name: string, email: string, password: string) {
    const data = await api.register(name, email, password);
    await this.setToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    await this.setToken(null);
  },

  async validateSession() {
    const token = await this.getStoredToken();
    if (!token) {
      throw new Error('No token found');
    }
    
    const user = await api.getProfile();
    return { user, token };
  }
}; 