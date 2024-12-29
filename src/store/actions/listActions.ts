import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storage } from '../../services/storage';
import { databaseService } from '../../services/database';
import { store } from '../index';
import type { List, ListItem } from '../../types/list';
import { syncService } from '../../services/sync';
import { 
  DeleteListItemPayload, 
  ShareListPayload, 
  UpdateListItemPayload 
} from '../types/listActionTypes';

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
      // Check network state from Redux store
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      const tempId = `temp_${Date.now()}`;
      const tempList = {
        _id: tempId,
        ...data,
        items: [],
        sharedWith: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to local storage first
      const storedLists = await storage.getLists() || [];
      await storage.saveLists([...storedLists, tempList]);

      if (!isConnected) {
        // Queue for sync when online
        await syncService.addPendingChange('CREATE_LIST', tempId, data);
        return tempList;
      }

      // If online, create on server
      const response = await api.post('/lists', data);
      const newList = response.data;

      // Update local storage with server response
      const updatedLists = storedLists.map(list => 
        list._id === tempId ? newList : list
      );
      await storage.saveLists(updatedLists);

      return newList;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create list');
    }
  }
);

export const updateList = createAsyncThunk(
  'lists/updateList',
  async ({ listId, data }: { listId: string, data: Partial<List> }, { rejectWithValue }) => {
    try {
      // Check network state from Redux store
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Update local storage first
      const storedLists = await storage.getLists() || [];
      const updatedLists = storedLists.map(list =>
        list._id === listId ? { ...list, ...data, updatedAt: new Date().toISOString() } : list
      );
      await storage.saveLists(updatedLists);

      if (!isConnected) {
        // Queue for sync when online
        await syncService.addPendingChange('UPDATE_LIST', listId, data);
        return updatedLists.find(list => list._id === listId);
      }

      // If online, update on server
      const response = await api.put(`/lists/${listId}`, data);
      const updatedList = response.data;

      // Update local storage with server response
      const finalLists = storedLists.map(list =>
        list._id === listId ? updatedList : list
      );
      await storage.saveLists(finalLists);

      return updatedList;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update list');
    }
  }
);

export const deleteList = createAsyncThunk(
  'lists/deleteList',
  async (listId: string, { rejectWithValue }) => {
    try {
      // Check network state from Redux store
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Remove from local storage first
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