import { databaseService } from './database';
import { Settings } from '../types/settings';

export const storage = {
  async getLists() {
    try {
      return await databaseService.getLists();
    } catch (error) {
      console.error('Error reading lists from storage:', error);
      return [];
    }
  },

  async saveLists(lists: any[]) {
    try {
      await databaseService.saveLists(lists);
    } catch (error) {
      console.error('Error saving lists to storage:', error);
    }
  },

  async getSharedLists() {
    try {
      return await databaseService.getSharedLists();
    } catch (error) {
      console.error('Error reading shared lists from storage:', error);
      return [];
    }
  },

  async saveSharedLists(lists: any[]) {
    try {
      await databaseService.saveSharedLists(lists);
    } catch (error) {
      console.error('Error saving shared lists to storage:', error);
    }
  },

  async getAuthToken() {
    try {
      const authData = await databaseService.getAuthData();
      return authData.token;
    } catch (error) {
      console.error('Error reading auth token from storage:', error);
      return null;
    }
  },

  async saveAuthToken(token: string | null) {
    try {
      const currentData = await databaseService.getAuthData();
      await databaseService.saveAuthData(token, currentData?.userData || null);
      console.log('[Storage] Auth token saved:', token ? 'token present' : 'token cleared');
    } catch (error) {
      console.error('Error saving auth token to storage:', error);
    }
  },

  async getUserData() {
    try {
      const authData = await databaseService.getAuthData();
      return authData.userData;
    } catch (error) {
      console.error('Error reading user data from storage:', error);
      return null;
    }
  },

  async saveUserData(userData: any | null) {
    try {
      const currentData = await databaseService.getAuthData();
      await databaseService.saveAuthData(currentData?.token || null, userData);
      console.log('[Storage] User data saved:', userData ? 'data present' : 'data cleared');
    } catch (error) {
      console.error('Error saving user data to storage:', error);
    }
  },

  async getSettings(): Promise<Settings | null> {
    try {
      return await databaseService.getSettings();
    } catch (error) {
      console.error('[Storage] Error reading settings:', error);
      return null;
    }
  },

  async saveSettings(settings: Partial<Settings>) {
    try {
      await databaseService.saveSettings(settings as Settings);
      console.log('[Storage] Settings saved successfully:', settings);
    } catch (error) {
      console.error('[Storage] Error saving settings:', error);
      throw error; // Propagate error to allow proper error handling in components
    }
  },

  async saveSelectedList(listId: string | null) {
    try {
      await databaseService.saveSelectedList(listId);
    } catch (error) {
      console.error('Error saving selected list to storage:', error);
    }
  },

  async getSelectedList() {
    try {
      return await databaseService.getSelectedList();
    } catch (error) {
      console.error('Error reading selected list from storage:', error);
      return null;
    }
  },

  async clearAll() {
    try {
      await databaseService.clearAllData();
      console.log('[Storage] All data cleared successfully');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}; 