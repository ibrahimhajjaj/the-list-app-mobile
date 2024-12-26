import api from './api';
import { API_CONFIG } from '../config/api';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdateData {
  name?: string;
  email?: string;
  password?: string;
}

export const userService = {
  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>(API_CONFIG.ENDPOINTS.AUTH.PROFILE);
    return response.data;
  },

  async updateProfile(data: ProfileUpdateData): Promise<UserProfile> {
    const response = await api.patch<UserProfile>(API_CONFIG.ENDPOINTS.AUTH.PROFILE, data);
    return response.data;
  },

  async searchUsers(query: string): Promise<UserProfile[]> {
    const response = await api.get<UserProfile[]>(`${API_CONFIG.ENDPOINTS.AUTH.SEARCH}?q=${encodeURIComponent(query)}`);
    return response.data;
  },
}; 