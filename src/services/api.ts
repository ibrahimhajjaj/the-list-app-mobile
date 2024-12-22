import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001/api';

console.log('API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
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
    console.log('Response:', {
      status: response.status,
      data: response.data,
    });
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

// Auth endpoints
export const login = async (email: string, password: string) => {
  try {
    console.log('Attempting login with:', { email });
    const response = await api.post('/users/login', { email, password });
    return response.data;
  } catch (error: any) {
    console.error('Login error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

export const register = async (name: string, email: string, password: string) => {
  try {
    console.log('Attempting registration with:', { name, email });
    const response = await api.post('/users/register', { name, email, password });
    console.log('Registration successful:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Registration error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
};

export const getProfile = async () => {
  const response = await api.get('/users/profile');
  return response.data;
};

export const updateProfile = async (data: { name?: string; email?: string; password?: string }) => {
  const response = await api.patch('/users/profile', data);
  return response.data;
};

// User search endpoints
export const searchUsers = async (query: string) => {
  const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

// List sharing endpoints
export const shareList = async (listId: string, userId: string, permission: 'view' | 'edit') => {
  const response = await api.post(`/lists/${listId}/share`, { userId, permission });
  return response.data;
};

export const removeShare = async (listId: string, userId: string) => {
  const response = await api.delete(`/lists/${listId}/share`, { data: { userId } });
  return response.data;
};

export const getSharedUsers = async (listId: string) => {
  const response = await api.get(`/lists/${listId}/share`);
  return response.data;
};

export default api; 