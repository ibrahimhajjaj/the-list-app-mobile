import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storage } from '../../services/storage';
import { databaseService } from '../../services/database';
import { store } from '../index';
import type { List, ListItem, AllowedListUpdates } from '../../types/list';
import { syncService } from '../../services/sync';
import { 
  DeleteListItemPayload, 
  ShareListPayload, 
  UpdateListItemPayload 
} from '../types/listActionTypes';

function generateTempId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `temp_${timestamp}_${random}`;
}

export const fetchLists = createAsyncThunk(
  'lists/fetchLists',
  async (_, { rejectWithValue }) => {
    try {
      // Check network state from Redux store
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // If offline, return stored lists
      if (!isConnected) {
        const storedLists = await storage.getLists();
        return storedLists || [];
      }

      // If online, fetch from API and update storage
      const response = await api.get('/lists');
      const lists = response.data;
      await storage.saveLists(lists);
      return lists;
    } catch (error: any) {
      // On error, try to return stored lists
      try {
        const storedLists = await storage.getLists();
        return storedLists || [];
      } catch (storageError) {
        return rejectWithValue(error.response?.data?.message || 'Failed to fetch lists');
      }
    }
  }
);

export const createList = createAsyncThunk(
  'lists/createList',
  async (data: Partial<List>, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;
      const tempId = generateTempId();

      // Create a temporary list while we wait for server response or handle offline state
      const tempList: List = {
        _id: tempId,
        title: data.title || 'Untitled List',
        items: data.items || [],
        sharedWith: data.sharedWith || [],
        owner: data.owner || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTemp: true,
        pendingSync: !isConnected,
        __v: 0,
        localVersion: 0
      };

      const storedLists = await storage.getLists() || [];
      await storage.saveLists([...storedLists, tempList]);

      // Handle offline creation
      if (!isConnected) {
        await syncService.addPendingChange('CREATE_LIST', tempId, data);
        return tempList;
      }

      // Create on server and update local storage with server response
      const response = await api.post('/lists', data);
      const newList = response.data;
      
      const currentLists = await storage.getLists() || [];
      const updatedLists = currentLists.map(list => 
        list._id === tempId ? { ...newList, _id: newList._id } : list
      );
      await storage.saveLists(updatedLists);
      await databaseService.saveIdMapping(tempId, newList._id, 'completed');

      return newList;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create list');
    }
  }
);

function validateListUpdates(data: Partial<List>): AllowedListUpdates {
  const allowedUpdates: AllowedListUpdates = {};
  
  // Only include allowed fields
  if ('title' in data) allowedUpdates.title = data.title;
  if ('items' in data) allowedUpdates.items = data.items;
  if ('category' in data) allowedUpdates.category = data.category;

  return allowedUpdates;
}

export const updateList = createAsyncThunk(
  'lists/updateList',
  async ({ listId, data }: { listId: string, data: Partial<List> }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Update local storage first for immediate UI feedback
      const storedLists = await storage.getLists() || [];
      const targetList = storedLists.find(list => list._id === listId);

      if (!targetList) {
        return rejectWithValue('List not found in storage');
      }

      // Validate and filter updates
      const validatedUpdates = validateListUpdates(data);
      const updatedList = {
        ...targetList,
        ...validatedUpdates,
        updatedAt: new Date().toISOString()
      };

      const updatedLists = storedLists.map(list =>
        list._id === listId ? updatedList : list
      );
      await storage.saveLists(updatedLists);

      // Handle offline updates
      if (!isConnected) {
        await syncService.addPendingChange('UPDATE_LIST', listId, validatedUpdates);
        return updatedList;
      }

      try {
        // Send update to server and handle potential conflicts
        const response = await api.patch(`/lists/${listId}`, validatedUpdates);
        const serverUpdatedList = response.data;
        
        // Update local storage with server response
		const finalLists = storedLists.map(list =>
          list._id === listId ? serverUpdatedList : list
        );
        await storage.saveLists(finalLists);

        return serverUpdatedList;
      } catch (error: any) {
        // Handle version conflicts by merging changes
        if (error.response?.status === 409) {
          const resolvedList = await syncService.handleConflict(
            listId,
            error.response.data.serverData,
            error.response.data.conflictType
          );
          return resolvedList;
        }
        throw error;
      }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update list');
    }
  }
);

export const deleteList = createAsyncThunk(
  'lists/deleteList',
  async (listId: string, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Remove from local storage first for immediate UI feedback
      const storedLists = await storage.getLists() || [];
      const updatedLists = storedLists.filter(list => list._id !== listId);
      await storage.saveLists(updatedLists);

      if (!isConnected) {
        // Queue for sync when online
        await syncService.addPendingChange('DELETE_LIST', listId, {});
        return listId;
      }

      // If online, delete from server
      await api.delete(`/lists/${listId}`);
      return listId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete list');
    }
  }
);

export const shareList = createAsyncThunk<List | null, ShareListPayload>(
  'lists/shareList',
  async ({ listId, data }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      if (!isConnected) {
        await syncService.addPendingChange('SHARE_LIST', listId, data);
        return null;
      }

      const response = await api.post<List>(`/lists/${listId}/share`, data);
      
      // Update stored lists
      const storedLists = await storage.getLists() || [];
      const updatedLists = storedLists.map(list => 
        list._id === listId ? response.data : list
      );
      await storage.saveLists(updatedLists);

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to share list');
    }
  }
);

export const unshareList = createAsyncThunk<List | null, { listId: string; email: string }>(
  'lists/unshareList',
  async ({ listId, email }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      if (!isConnected) {
        await syncService.addPendingChange('UNSHARE_LIST', listId, { email });
        return null;
      }

      const response = await api.delete<List>(`/lists/${listId}/share`, { data: { email } });
      
      // Update stored lists
      const storedLists = await storage.getLists() || [];
      const updatedLists = storedLists.map(list =>
        list._id === listId ? response.data : list
      );
      await storage.saveLists(updatedLists);

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unshare list');
    }
  }
);

export const fetchListById = createAsyncThunk<List, string>(
  'lists/fetchListById',
  async (listId, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Try to get list from storage first
      const storedLists = await storage.getLists() || [];
      const storedList = storedLists.find(list => list._id === listId);
      
      if (!isConnected) {
        if (!storedList) {
          return rejectWithValue('List not found in offline storage');
        }
        return storedList;
      }

      // If online, fetch from API and update storage
      const response = await api.get<List>(`/lists/${listId}`);
      
      // Update the list in stored lists
      const updatedLists = storedLists.map(list =>
        list._id === listId ? response.data : list
      );
      await storage.saveLists(updatedLists);

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch list');
    }
  }
);

export const updateListItem = createAsyncThunk<List, UpdateListItemPayload>(
  'lists/updateListItem',
  async ({ listId, itemId, updates }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Get current list from storage
      const storedLists = await storage.getLists() || [];
      const currentList = storedLists.find(list => list._id === listId);
      
      if (!currentList) {
        return rejectWithValue('List not found');
      }

      // Update locally first
      const updatedList = {
        ...currentList,
        items: currentList.items.map((item: ListItem) =>
          item._id === itemId ? { ...item, ...updates } : item
        ),
        updatedAt: new Date().toISOString()
      };

      // Save to local storage
      const updatedLists = storedLists.map(list =>
        list._id === listId ? updatedList : list
      );
      await storage.saveLists(updatedLists);

      if (!isConnected) {
        await syncService.addPendingChange('UPDATE_LIST', listId, { items: updatedList.items });
        return updatedList;
      }

      const response = await api.patch<List>(`/lists/${listId}/items/${itemId}`, updates);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update list item');
    }
  }
);

export const deleteListItem = createAsyncThunk<DeleteListItemPayload, DeleteListItemPayload>(
  'lists/deleteListItem',
  async ({ listId, itemId }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Get current list from storage
      const storedLists = await storage.getLists() || [];
      const currentList = storedLists.find(list => list._id === listId);
      
      if (!currentList) {
        return rejectWithValue('List not found');
      }

      // Update locally first
      const updatedList = {
        ...currentList,
        items: currentList.items.filter((item: ListItem) => item._id !== itemId),
        updatedAt: new Date().toISOString()
      };

      // Save to local storage
      const updatedLists = storedLists.map(list =>
        list._id === listId ? updatedList : list
      );
      await storage.saveLists(updatedLists);

      if (!isConnected) {
        await syncService.addPendingChange('UPDATE_LIST', listId, { items: updatedList.items });
        return { listId, itemId };
      }

      await api.delete(`/lists/${listId}/items/${itemId}`);
      return { listId, itemId };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete list item');
    }
  }
); 