import { databaseService } from './database';
import { Settings } from '../types/settings';

export const storage = {
  // Retrieves all lists from storage
  async getLists(): Promise<any[]> {
    try {
      const lists = await databaseService.getLists();
      return lists;
    } catch (error) {
      console.error('[Storage] Error retrieving lists:', error);
      return [];
    }
  },

  // Saves lists to storage, handling duplicates and merging with existing lists
  async saveLists(lists: any[]): Promise<void> {
    try {
      await databaseService.saveLists(lists);
    } catch (error) {
      console.error('[Storage] Error saving lists:', error);
      throw error;
    }
  },

  // Helper function to find duplicate lists by ID
  findDuplicates(lists: any[]): { [key: string]: number } {
    const counts: { [key: string]: number } = {};
    lists.forEach(list => {
      if (list._id) {
        counts[list._id] = (counts[list._id] || 0) + 1;
      }
    });
    
    return Object.fromEntries(
      Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .map(([id, count]) => [id, count])
    );
  },

  // Merges old and new lists, preferring newer versions
  mergeLists(oldLists: any[], newLists: any[]): any[] {
    const listMap = new Map(oldLists.map(list => [list._id, list]));
    
    newLists.forEach(newList => {
      if (newList._id) {
        listMap.set(newList._id, newList);
      }
    });
    
    return Array.from(listMap.values());
  },

  // Shared lists operations
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
      throw error;
    }
  },

  // Auth operations
  async getAuthToken() {
    try {
      const authData = await databaseService.getAuthData();
      return authData.token;
    } catch (error) {
      console.error('[Storage] Error reading auth token:', error);
      return null;
    }
  },

  async saveAuthToken(token: string | null) {
    try {
      const currentData = await databaseService.getAuthData();
      await databaseService.saveAuthData(token, currentData?.userData || null);
    } catch (error) {
      console.error('[Storage] Error saving auth token:', error);
      throw error;
    }
  },

  async getUserData() {
    try {
      const authData = await databaseService.getAuthData();
      return authData.userData;
    } catch (error) {
      return null;
    }
  },

  async saveUserData(userData: any | null) {
    try {
      const currentData = await databaseService.getAuthData();
      await databaseService.saveAuthData(currentData?.token || null, userData);
    } catch (error) {
      throw error;
    }
  },

  // Settings operations
  async getSettings(): Promise<Settings | null> {
    try {
      const settings = await databaseService.getSettings();
      return settings;
    } catch (error) {
      console.error('[Storage] Error reading settings:', error);
      return null;
    }
  },

  async saveSettings(settings: Partial<Settings>) {
    try {
      await databaseService.saveSettings(settings as Settings);
    } catch (error) {
      console.error('[Storage] Error saving settings:', error);
      throw error;
    }
  },

  // Selected list operations
  async saveSelectedList(listId: string | null) {
    try {
      await databaseService.saveSelectedList(listId);
    } catch (error) {
      console.error('[Storage] Error saving selected list:', error);
    }
  },

  async getSelectedList() {
    try {
      const selectedList = await databaseService.getSelectedList();
      return selectedList;
    } catch (error) {
      console.error('[Storage] Error reading selected list:', error);
      return null;
    }
  },

  // Data management operations
  async clearAll() {
    try {
      await databaseService.clearAllData();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },

  // Resets local database while preserving authentication data
  async resetLocalDBExceptAuth() {
    try {
      const authToken = await this.getAuthToken();
      const userData = await this.getUserData();
      
      await databaseService.clearAllData();
      
      if (authToken) {
        await this.saveAuthToken(authToken);
      }
      if (userData) {
        await this.saveUserData(userData);
      }
    } catch (error) {
      console.error('[Storage] Error resetting local DB:', error);
      throw error;
    }
  }
}; 