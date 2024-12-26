import Constants from 'expo-constants';

export const API_CONFIG = {
  BASE_URL: Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001/api',
  HEADERS: {
    'Content-Type': 'application/json',
  },
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/users/login',
      REGISTER: '/users/register',
      PROFILE: '/users/profile',
      SEARCH: '/users/search',
    },
    LISTS: {
      BASE: '/lists',
      SHARE: (listId: string) => `/lists/${listId}/share`,
    },
  },
  TOKEN_KEY: '@app:auth_token',
} as const;

// Helper to create full URLs when needed
export const createUrl = (endpoint: string) => `${API_CONFIG.BASE_URL}${endpoint}`; 