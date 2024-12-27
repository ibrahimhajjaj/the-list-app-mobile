import { API_CONFIG } from '../config/api';
import { storage } from './storage';
import { authApi } from './api';
import type { AuthResponse } from '../types/auth';

export const authService = {
  async getStoredToken(): Promise<string | null> {
    return storage.getAuthToken();
  },

  async setToken(token: string | null): Promise<void> {
    await storage.saveAuthToken(token);
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await authApi.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, { email, password });
      const data = response.data;
      await this.setToken(data.token);
      return data;
    } catch (error: any) {
      console.error('[Auth Service] Login error:', error.response?.data || error.message);
      throw error;
    }
  },

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await authApi.post<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH.REGISTER, { name, email, password });
      const data = response.data;
      await this.setToken(data.token);
      return data;
    } catch (error: any) {
      console.error('[Auth Service] Registration error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  },

  async logout(): Promise<void> {
    await this.setToken(null);
  },

  async validateSession(): Promise<{ user: any; token: string }> {
    try {
      const token = await this.getStoredToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await authApi.get<AuthResponse>(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
      return { user: response.data.user, token };
    } catch (error: any) {
      console.error('[Auth Service] Session validation error:', error.response?.data || error.message);
      await this.setToken(null); // Clear token if validation fails
      throw error;
    }
  }
}; 