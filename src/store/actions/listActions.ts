import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storage } from '../../services/storage';
import {
  setLists,
  addList,
  updateList as updateListInStore,
  deleteList as deleteListFromStore,
  setLoading,
  setError,
  setCurrentList,
} from '../slices/listSlice';
import { AppDispatch } from '..';
import NetInfo from '@react-native-community/netinfo';
import { List } from '../slices/listSlice';

const isConnected = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected;
};

export const fetchLists = createAsyncThunk(
  'lists/fetchLists',
  async () => {
    const response = await api.get<List[]>('/lists');
    return response.data;
  }
);

export const fetchSharedLists = () => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));
    
    // Try to get shared lists from storage first
    const storedLists = await storage.getSharedLists() as List[];
    if (storedLists.length > 0) {
      dispatch(setLists(storedLists));
    }

    // If online, fetch from API and update storage
    if (await isConnected()) {
      const response = await api.get<List[]>('/lists/shared');
      dispatch(setLists(response.data));
      await storage.saveSharedLists(response.data);
    }
  } catch (error: any) {
    dispatch(setError(error.response?.data?.message || 'Failed to fetch shared lists'));
  } finally {
    dispatch(setLoading(false));
  }
};

export const createList = createAsyncThunk(
  'lists/createList',
  async (data: { title: string }) => {
    const response = await api.post<List>('/lists', data);
    return response.data;
  }
);

export const updateList = (listId: string, updates: Partial<Omit<List, '_id' | 'owner' | 'sharedWith' | 'createdAt' | 'updatedAt'>>) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));

    if (!(await isConnected())) {
      throw new Error('No internet connection');
    }

    const response = await api.patch<List>(`/lists/${listId}`, updates);
    dispatch(updateListInStore(response.data));
    
    // Update stored lists
    const storedLists = await storage.getLists() as List[];
    const updatedLists = storedLists.map(list =>
      list._id === listId ? response.data : list
    );
    await storage.saveLists(updatedLists);
    
    return response.data;
  } catch (error: any) {
    dispatch(setError(error.response?.data?.message || 'Failed to update list'));
    throw error;
  } finally {
    dispatch(setLoading(false));
  }
};

export const deleteList = createAsyncThunk(
  'lists/deleteList',
  async (listId: string) => {
    await api.delete(`/lists/${listId}`);
    return listId;
  }
);

export const shareList = (listId: string, data: { userId: string; permission: 'view' | 'edit' }) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));

    if (!(await isConnected())) {
      throw new Error('No internet connection');
    }

    const response = await api.post<List>(`/lists/${listId}/share`, data);
    dispatch(updateListInStore(response.data));
    
    // Update stored lists
    const storedLists = await storage.getLists() as List[];
    const updatedLists = storedLists.map(list =>
      list._id === listId ? response.data : list
    );
    await storage.saveLists(updatedLists);
    
    return response.data;
  } catch (error: any) {
    dispatch(setError(error.response?.data?.message || 'Failed to share list'));
    throw error;
  }
};

export const unshareList = (listId: string, userId: string) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));

    if (!(await isConnected())) {
      throw new Error('No internet connection');
    }

    const response = await api.delete<List>(`/lists/${listId}/share/${userId}`);
    dispatch(updateListInStore(response.data));
    
    // Update stored lists
    const storedLists = await storage.getLists() as List[];
    const updatedLists = storedLists.map(list =>
      list._id === listId ? response.data : list
    );
    await storage.saveLists(updatedLists);
    
    return response.data;
  } catch (error: any) {
    dispatch(setError(error.response?.data?.message || 'Failed to unshare list'));
    throw error;
  }
};

export const fetchListById = (listId: string) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));
    
    // Try to get list from storage first
    const storedLists = await storage.getLists() as List[];
    const storedList = storedLists.find(list => list._id === listId);
    if (storedList) {
      dispatch(setCurrentList(storedList));
    }

    // If online, fetch from API and update storage
    if (await isConnected()) {
      const response = await api.get<List>(`/lists/${listId}`);
      dispatch(setCurrentList(response.data));
      
      // Update the list in stored lists
      const updatedLists = storedLists.map(list =>
        list._id === listId ? response.data : list
      );
      await storage.saveLists(updatedLists);
    }
  } catch (error: any) {
    dispatch(setError(error.response?.data?.message || 'Failed to fetch list'));
  } finally {
    dispatch(setLoading(false));
  }
};

export const updateListItem = createAsyncThunk(
  'lists/updateListItem',
  async ({ listId, itemId, updates }: { listId: string; itemId: string; updates: Partial<List['items'][0]> }) => {
    const response = await api.patch<List>(`/lists/${listId}/items/${itemId}`, updates);
    return response.data;
  }
);

export const deleteListItem = createAsyncThunk(
  'lists/deleteListItem',
  async ({ listId, itemId }: { listId: string; itemId: string }) => {
    await api.delete(`/lists/${listId}/items/${itemId}`);
    return { listId, itemId };
  }
); 