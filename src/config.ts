import Constants from 'expo-constants';

export const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001';
export const API_ENDPOINT = `${API_URL}/api`;
export const WS_URL = API_URL; 