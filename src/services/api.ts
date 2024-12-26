import axios from 'axios';
import { API_CONFIG } from '../config/api';
import { storage } from './storage';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: API_CONFIG.HEADERS,
});

// Add token to requests if it exists
api.interceptors.request.use(
  async (config) => {
    const token = await storage.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('Response Error:', {
      message: error.message,
      response: {
        status: error.response?.status,
        data: error.response?.data,
      },
      request: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
      },
    });
    return Promise.reject(error);
  }
);

// List sharing endpoints
export const shareList = async (listId: string, userId: string, permission: 'view' | 'edit') => {
  const response = await api.post(API_CONFIG.ENDPOINTS.LISTS.SHARE(listId), { userId, permission });
  return response.data;
};

export const removeShare = async (listId: string, userId: string) => {
  const response = await api.delete(API_CONFIG.ENDPOINTS.LISTS.SHARE(listId), { data: { userId } });
  return response.data;
};

export const getSharedUsers = async (listId: string) => {
  const response = await api.get(API_CONFIG.ENDPOINTS.LISTS.SHARE(listId));
  return response.data;
};

export default api; 