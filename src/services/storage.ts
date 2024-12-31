import AsyncStorage from '@react-native-async-storage/async-storage';
import { databaseService } from './database';
import { Settings } from '../types/settings';

export const storage = {
  async getLists(): Promise<any[]> {
    try {
      const listsJson = await AsyncStorage.getItem('lists');
      const lists = listsJson ? JSON.parse(listsJson) : [];
      
      console.log('[Storage] Retrieved lists:', {
        count: lists.length,
        tempCount: lists.filter((l: any) => l._id?.startsWith('temp_')).length,
        duplicates: this.findDuplicates(lists)
      });
      
      return lists;
    } catch (error) {
      console.error('[Storage] Error retrieving lists:', error);
      return [];
    }
  },

  async saveLists(lists: any[]): Promise<void> {
    console.log('[Storage] Saving lists:', {
      count: lists.length,
      ids: lists.map(l => ({ 
        id: l._id,
        title: l.title,
        isTemp: l._id?.startsWith('temp_')
      }))
    });

    const existingLists = await this.getLists();
    console.log('[Storage] Existing lists:', {
      count: existingLists.length,
      tempCount: existingLists.filter(l => l._id?.startsWith('temp_')).length,
      duplicates: this.findDuplicates(existingLists)
    });

    // Merge lists, preferring new versions over old ones
    const mergedLists = this.mergeLists(existingLists, lists);
    
    console.log('[Storage] After merge:', {
      count: mergedLists.length,
      tempCount: mergedLists.filter(l => l._id?.startsWith('temp_')).length,
      duplicates: this.findDuplicates(mergedLists),
      listSummary: mergedLists.map(l => ({
        id: l._id,
        title: l.title,
        isTemp: l._id?.startsWith('temp_')
      }))
    });

    await AsyncStorage.setItem('lists', JSON.stringify(mergedLists));
  },

  findDuplicates(lists: any[]): { [key: string]: number } {
    const counts: { [key: string]: number } = {};
    const details: { [key: string]: { count: number, titles: string[] } } = {};
    
    lists.forEach(list => {
      if (list._id) {
        counts[list._id] = (counts[list._id] || 0) + 1;
        if (!details[list._id]) {
          details[list._id] = { count: 0, titles: [] };
        }
        details[list._id].count++;
        details[list._id].titles.push(list.title);
      }
    });

    // Log detailed duplicate information
    Object.entries(details)
      .filter(([_, info]) => info.count > 1)
      .forEach(([id, info]) => {
        console.log('[Storage] Duplicate list details:', {
          id: id,
          count: info.count,
          titles: info.titles,
          fullId: id
        });
      });
    
    return Object.fromEntries(
      Object.entries(counts)
        .filter(([_, count]) => count > 1)
        .map(([id, count]) => [id, count])
    );
  },

  mergeLists(oldLists: any[], newLists: any[]): any[] {
    // Create a map of existing lists by ID
    const listMap = new Map(oldLists.map(list => [list._id, list]));
    
    // Track potential duplicates
    const duplicateTracker = new Set<string>();
    const seenIds = new Set<string>();
    
    // Update or add new lists
    newLists.forEach(newList => {
      if (newList._id) {
        if (seenIds.has(newList._id)) {
          duplicateTracker.add(newList._id);
          console.log('[Storage] Duplicate detected:', {
            id: newList._id,
            title: newList.title,
            existingTitle: listMap.get(newList._id)?.title
          });
        }
        seenIds.add(newList._id);
        listMap.set(newList._id, newList);
      }
    });

    // Log duplicate summary if any found
    if (duplicateTracker.size > 0) {
      console.log('[Storage] Duplicate summary:', {
        count: duplicateTracker.size,
        ids: Array.from(duplicateTracker)
      });
    }
    
    return Array.from(listMap.values());
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
  },

  async resetLocalDBExceptAuth() {
    try {
      // Save current auth data
      const authToken = await this.getAuthToken();
      const userData = await this.getUserData();
      
	  await databaseService.clearAllData();
      // Clear all data
      await AsyncStorage.clear();
      
      // Restore auth data if it existed
      if (authToken) {
        await this.saveAuthToken(authToken);
      }
      if (userData) {
        await this.saveUserData(userData);
      }
      
      console.log('[Storage] Local DB reset completed (auth data preserved)');
    } catch (error) {
      console.error('[Storage] Error resetting local DB:', error);
      throw error;
    }
  }
}; 