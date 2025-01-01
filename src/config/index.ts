import Constants from 'expo-constants';

console.log(Constants.expoConfig?.extra);
export const API_URL = Constants.expoConfig?.extra?.API_URL || 'http://localhost:5001/api';
export const WS_URL = Constants.expoConfig?.extra?.WS_URL || 'http://localhost:5001';
export const EXPO_PROJECT_ID = Constants.expoConfig?.extra?.EXPO_PROJECT_ID;
