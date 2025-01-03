import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001';
export const API_ENDPOINT = `${API_URL}/api`;

// WebSocket URL should be the base URL without /api
export const WS_URL = API_URL.replace('/api', '');

export { API_URL };