import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  LISTS: '@app:lists',
  SHARED_LISTS: '@app:shared_lists',
  AUTH_TOKEN: '@app:auth_token',
  USER_DATA: '@app:user_data',
  SELECTED_LIST: '@app:selected_list',
  SETTINGS: '@app:settings',
};

export const storage = {
  async getLists() {
    try {
      const listsJson = await AsyncStorage.getItem(STORAGE_KEYS.LISTS);
      return listsJson ? JSON.parse(listsJson) : [];
    } catch (error) {
      console.error('Error reading lists from storage:', error);
      return [];
    }
  },

  async saveLists(lists: any[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LISTS, JSON.stringify(lists));
    } catch (error) {
      console.error('Error saving lists to storage:', error);
    }
  },

  async getSharedLists() {
    try {
      const listsJson = await AsyncStorage.getItem(STORAGE_KEYS.SHARED_LISTS);
      return listsJson ? JSON.parse(listsJson) : [];
    } catch (error) {
      console.error('Error reading shared lists from storage:', error);
      return [];
    }
  },

  async saveSharedLists(lists: any[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SHARED_LISTS, JSON.stringify(lists));
    } catch (error) {
      console.error('Error saving shared lists to storage:', error);
    }
  },

  async getAuthToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Error reading auth token from storage:', error);
      return null;
    }
  },

  async saveAuthToken(token: string | null) {
    try {
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
    } catch (error) {
      console.error('Error saving auth token to storage:', error);
    }
  },

  async getUserData() {
    try {
      const userJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Error reading user data from storage:', error);
      return null;
    }
  },

  async saveUserData(userData: any | null) {
    try {
      if (userData) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      }
    } catch (error) {
      console.error('Error saving user data to storage:', error);
    }
  },

  async getSettings() {
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return settingsJson ? JSON.parse(settingsJson) : null;
    } catch (error) {
      console.error('Error reading settings from storage:', error);
      return null;
    }
  },

  async saveSettings(settings: any) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      console.log('[Storage] Settings saved successfully:', settings);
    } catch (error) {
      console.error('Error saving settings to storage:', error);
    }
  },

  async clearAll() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.LISTS,
        STORAGE_KEYS.SHARED_LISTS,
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.SELECTED_LIST,
        STORAGE_KEYS.SETTINGS,
      ]);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },

  async saveSelectedList(listId: string | null) {
    try {
      if (listId) {
        await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_LIST, listId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_LIST);
      }
    } catch (error) {
      console.error('Error saving selected list to storage:', error);
    }
  },

  async getSelectedList() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_LIST);
    } catch (error) {
      console.error('Error reading selected list from storage:', error);
      return null;
    }
  },
}; 