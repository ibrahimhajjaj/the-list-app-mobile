import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../config/api';
import { storage } from './storage';

// Create axios instance factory with proper typing
const createAPI = (config: typeof API_CONFIG): AxiosInstance => {
  const instance = axios.create({
    baseURL: config.BASE_URL,
    headers: config.HEADERS,
  });

  // Add request interceptor for auth token
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        const token = await storage.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      } catch (error) {
        console.error('[API] Request interceptor error:', error);
        return config;
      }
    },
    (error) => {
      console.error('[API] Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Log error details
      console.error('[API] Response error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: originalRequest?.url,
        method: originalRequest?.method,
      });

      // Handle 401 errors (Unauthorized)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        // Clear token on auth error
        await storage.saveAuthToken(null);
        
        // Let the auth slice handle the redirect to login
        return Promise.reject(error);
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

// Create API instances
export const api = createAPI(API_CONFIG);
export const authApi = createAPI(API_CONFIG);

// List sharing endpoints with proper error handling
export const shareList = async (listId: string, userId: string, permission: 'view' | 'edit') => {
  try {
    const response = await api.post(API_CONFIG.ENDPOINTS.LISTS.SHARE(listId), { userId, permission });
    return response.data;
  } catch (error) {
    console.error('[API] Share list error:', error);
    throw error;
  }
};

export const removeShare = async (listId: string, userId: string) => {
  try {
    const response = await api.delete(API_CONFIG.ENDPOINTS.LISTS.SHARE(listId), { data: { userId } });
    return response.data;
  } catch (error) {
    console.error('[API] Remove share error:', error);
    throw error;
  }
};

export const getSharedUsers = async (listId: string) => {
  try {
    const response = await api.get(API_CONFIG.ENDPOINTS.LISTS.SHARE(listId));
    return response.data;
  } catch (error) {
    console.error('[API] Get shared users error:', error);
    throw error;
  }
};

export default api; 