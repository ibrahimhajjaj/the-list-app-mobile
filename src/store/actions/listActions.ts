import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storage } from '../../services/storage';
import { List } from '../../types/list';
import { DeleteListPayload, DeleteListItemPayload, ShareListPayload, UpdateListItemPayload } from '../types/listActionTypes';
import { AppDispatch } from '..';
import NetInfo from '@react-native-community/netinfo';
import {
  setLists,
  addList,
  updateListInStore,
  setLoading,
  setError,
  setCurrentList,
} from './listActionCreators';

const isConnected = async () => {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected;
};

export const fetchLists = createAsyncThunk<List[]>(
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

export const createList = createAsyncThunk<List, { title: string }>(
  'lists/createList',
  async (data, { dispatch }) => {
    const response = await api.post<List>('/lists', data);
    
    // Update stored lists
    const storedLists = await storage.getLists();
    const updatedLists = [...storedLists, response.data];
    await storage.saveLists(updatedLists);
    
    // Add to store immediately
    dispatch(addList(response.data));
    
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

export const deleteList = createAsyncThunk<DeleteListPayload, string>(
  'lists/deleteList',
  async (listId, { dispatch }) => {
    await api.delete(`/lists/${listId}`);
    
    // Update stored lists
    const storedLists = await storage.getLists() as List[];
    const remainingLists = storedLists.filter(list => list._id !== listId);
    await storage.saveLists(remainingLists);
    
    return { deletedId: listId };
  }
);

export const shareList = createAsyncThunk<List, ShareListPayload>(
  'lists/shareList',
  async ({ listId, data }) => {
    const response = await api.post<List>(`/lists/${listId}/share`, data);
    
    // Update stored lists
    const storedLists = await storage.getLists() as List[];
    const updatedLists = storedLists.map(list =>
      list._id === listId ? response.data : list
    );
    await storage.saveLists(updatedLists);
    
    return response.data;
  }
);

export const unshareList = (listId: string, email: string) => async (dispatch: AppDispatch) => {
  try {
    dispatch(setLoading(true));

    if (!(await isConnected())) {
      throw new Error('No internet connection');
    }

    const response = await api.delete<List>(`/lists/${listId}/share`, { data: { email } });
    dispatch(updateListInStore(response.data));
    
    // Update stored lists
    const storedLists = await storage.getLists() as List[];
    const updatedLists = storedLists.map(list =>
      list._id === listId ? response.data : list
    );
    await storage.saveLists(updatedLists);
    
    return response.data;
  } catch (error: any) {
    dispatch(setError(error.response?.data?.error || 'Failed to unshare list'));
    throw error;
  } finally {
    dispatch(setLoading(false));
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

export const updateListItem = createAsyncThunk<List, UpdateListItemPayload>(
  'lists/updateListItem',
  async ({ listId, itemId, updates }) => {
    const response = await api.patch<List>(`/lists/${listId}/items/${itemId}`, updates);
    return response.data;
  }
);

export const deleteListItem = createAsyncThunk<DeleteListItemPayload, DeleteListItemPayload>(
  'lists/deleteListItem',
  async ({ listId, itemId }) => {
    await api.delete(`/lists/${listId}/items/${itemId}`);
    return { listId, itemId };
  }
); 