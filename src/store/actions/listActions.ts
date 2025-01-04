import { createAsyncThunk, createAction } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storage } from '../../services/storage';
import { databaseService } from '../../services/database';
import { store } from '../index';
import type { List } from '../../types/list';
import { ACTION_TYPES } from '../../types/list';
import syncService from '../../services/sync';
import { ShareListPayload } from '../types/listActionTypes';

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
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
        await syncService.addPendingChange(ACTION_TYPES.CREATE_LIST, tempId, data);
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

interface AllowedListUpdates {
  title?: string;
  description?: string;
  category?: string;
}

function validateListUpdates(data: Partial<List>): AllowedListUpdates {
  const allowedUpdates: AllowedListUpdates = {};
  
  // Only include allowed fields with proper type assertions
  if ('title' in data && typeof data.title === 'string') {
    allowedUpdates.title = data.title;
  }
  if ('description' in data && typeof data.description === 'string') {
    allowedUpdates.description = data.description;
  }
  if ('category' in data && typeof data.category === 'string') {
    allowedUpdates.category = data.category;
  }

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
        await syncService.addPendingChange(ACTION_TYPES.UPDATE_LIST, listId, validatedUpdates);
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
        await syncService.addPendingChange(ACTION_TYPES.DELETE_LIST, listId, {});
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
        await syncService.addPendingChange(ACTION_TYPES.SHARE_LIST, listId, data);
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
        await syncService.addPendingChange(ACTION_TYPES.UNSHARE_LIST, listId, { email });
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

export const fetchListById = createAsyncThunk(
  'lists/fetchListById',
  async (listId: string, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // If offline, return stored list
      if (!isConnected) {
        const storedLists = await storage.getLists();
        const list = storedLists?.find(l => l._id === listId);
        if (!list) {
          return rejectWithValue('List not found in local storage');
        }
        return list;
      }

      // If online, fetch from API and update storage
      const response = await api.get(`/lists/${listId}`);
      const list = response.data;

      // Update the list in storage
      const storedLists = await storage.getLists() || [];
      const updatedLists = storedLists.map(l => 
        l._id === listId ? list : l
      );
      await storage.saveLists(updatedLists);

      return list;
    } catch (error: any) {
      // On error, try to return stored list
      try {
        const storedLists = await storage.getLists();
        const list = storedLists?.find(l => l._id === listId);
        if (list) {
          return list;
        }
      } catch (storageError) {
        // If both API and storage fail, return error
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch list');
    }
  }
);

// Sync action for updating list in store during sync
export const updateListInStore = createAction<List>('lists/updateListInStore');