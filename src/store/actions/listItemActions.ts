import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { storage } from '../../services/storage';
import { store } from '../index';
import { ListItem } from '../../types/list';
import { ACTION_TYPES } from '../../types/list';
import syncService from '../../services/sync';
import { API_CONFIG } from '../../config/api';
import databaseService from '../../services/database';

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export const addListItems = createAsyncThunk(
  'lists/addListItems',
  async ({ listId, items }: { 
    listId: string, 
    items: Array<{ text: string; completed?: boolean }> 
  }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      console.log('[ListItemActions] Adding items:', {
        listId,
        itemCount: items.length,
        isConnected
      });

      // Create temporary items
      const tempItems = items.map(item => ({
        _id: generateTempId(),
        text: item.text,
        completed: item.completed || false,
        position: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTemp: true
      }));

      console.log('[ListItemActions] Created temp items:', {
        tempIds: tempItems.map(i => i._id)
      });

      // Update local storage first
      const storedLists = await storage.getLists() || [];
      const targetList = storedLists.find(list => list._id === listId);
      
      if (!targetList) {
        return rejectWithValue('List not found');
      }

      const updatedList = {
        ...targetList,
        items: [...targetList.items, ...tempItems],
        updatedAt: new Date().toISOString()
      };

      console.log('[ListItemActions] Updating storage with temp items');
      await storage.saveLists(storedLists.map(list => 
        list._id === listId ? updatedList : list
      ));

      if (!isConnected) {
        console.log('[ListItemActions] Offline - adding to sync queue');
        await syncService.addPendingChange(ACTION_TYPES.ADD_LIST_ITEM, listId, { items: tempItems });
        return { listId, items: tempItems };
      }

      // Send to server
      console.log('[ListItemActions] Online - sending to server');
      const response = await api.post(API_CONFIG.ENDPOINTS.LISTS.ITEMS.BASE(listId), { items });
      const newItems = response.data;

      console.log('[ListItemActions] Server response:', {
        newItemIds: newItems.map((i: any) => i._id)
      });

      // Update local storage with server response
      const currentLists = await storage.getLists() || [];
      const finalList = currentLists.find(list => list._id === listId);
      
      if (finalList) {
        finalList.items = [
          ...finalList.items.filter((item: ListItem) => !tempItems.some((temp: ListItem) => temp._id === item._id)),
          ...newItems
        ];
        console.log('[ListItemActions] Updating storage with server items');
        await storage.saveLists(currentLists.map(list =>
          list._id === listId ? finalList : list
        ));
      }

      return { listId, items: newItems };
    } catch (error: any) {
      console.error('[ListItemActions] Error adding items:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to add items');
    }
  }
);

export const updateListItem = createAsyncThunk(
  'lists/updateListItem',
  async ({ 
    listId, 
    itemId, 
    updates 
  }: { 
    listId: string, 
    itemId: string, 
    updates: Partial<ListItem> 
  }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      console.log('[ListItemActions] Updating item:', {
        listId,
        itemId,
        updates,
        isConnected,
        isTemp: itemId.startsWith('temp_')
      });

      // Update local storage first
      const storedLists = await storage.getLists() || [];
      const targetList = storedLists.find(list => list._id === listId);

      if (!targetList) {
        console.log('[ListItemActions] List not found in storage:', listId);
        return rejectWithValue('List not found');
      }

      console.log('[ListItemActions] Found list:', {
        listId: targetList._id,
        itemCount: targetList.items.length,
        hasTargetItem: targetList.items.some((item: ListItem) => item._id === itemId)
      });

      const updatedList = {
        ...targetList,
        items: targetList.items.map((item: ListItem) => {
          if (item._id === itemId) {
            console.log('[ListItemActions] Updating item in list:', {
              itemId: item._id,
              oldState: item,
              newState: { ...item, ...updates }
            });
            return { ...item, ...updates, updatedAt: new Date().toISOString() };
          }
          return item;
        }),
        updatedAt: new Date().toISOString()
      };

      console.log('[ListItemActions] Saving updated list to storage');
      await storage.saveLists(storedLists.map(list =>
        list._id === listId ? updatedList : list
      ));

      if (!isConnected) {
        console.log('[ListItemActions] Offline - adding to sync queue');
        await syncService.addPendingChange(ACTION_TYPES.UPDATE_LIST_ITEM, listId, { itemId, updates });
        return { listId, itemId, updates };
      }

      // Send to server
      console.log('[ListItemActions] Online - sending to server');
      const response = await api.patch(API_CONFIG.ENDPOINTS.LISTS.ITEMS.SINGLE(listId, itemId), updates);
      const updatedItem = response.data;

      console.log('[ListItemActions] Server response:', {
        itemId: updatedItem._id,
        updates: updatedItem
      });

      // Update local storage with server response
      const currentLists = await storage.getLists() || [];
      const finalList = currentLists.find(list => list._id === listId);
      
      if (finalList) {
        finalList.items = finalList.items.map((item: ListItem) =>
          item._id === itemId ? updatedItem : item
        );
        console.log('[ListItemActions] Updating storage with server response');
        await storage.saveLists(currentLists.map(list =>
          list._id === listId ? finalList : list
        ));
      }

      return { listId, item: updatedItem };
    } catch (error: any) {
      console.error('[ListItemActions] Error updating item:', error);
      return rejectWithValue(error.response?.data?.message || 'Failed to update list item');
    }
  }
);

export const deleteListItem = createAsyncThunk(
  'lists/deleteListItem',
  async ({ listId, itemId }: { listId: string, itemId: string }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      console.log('[ListItemActions] Deleting item:', { listId, itemId });

      // Update local storage first
      const storedLists = await storage.getLists() || [];
      const targetList = storedLists.find(list => list._id === listId);

      if (!targetList) {
        return rejectWithValue('List not found');
      }

      const updatedList = {
        ...targetList,
        items: targetList.items.filter((item: ListItem) => item._id !== itemId),
        updatedAt: new Date().toISOString()
      };

      await storage.saveLists(storedLists.map(list =>
        list._id === listId ? updatedList : list
      ));

      // If it's a temporary item, we need to update any pending ADD_LIST_ITEM changes
      if (itemId.startsWith('temp_')) {
        console.log('[ListItemActions] Deleting temporary item from pending changes');
        const pendingChanges = await databaseService.getPendingChanges();
        
        for (const change of pendingChanges) {
          if (change.actionType === ACTION_TYPES.ADD_LIST_ITEM && change.entityId === listId) {
            const items = change.data.items.filter((item: ListItem) => item._id !== itemId);
            if (items.length === 0) {
              // If no items left, remove the entire change
              await databaseService.removePendingChange(change.id);
            } else {
              // Update the change with remaining items
              await databaseService.updatePendingChange(change.id, {
                ...change,
                data: { ...change.data, items }
              });
            }
          }
        }
        return { listId, itemId };
      }

      if (!isConnected) {
        await syncService.addPendingChange(ACTION_TYPES.DELETE_LIST_ITEM, listId, { itemId });
        return { listId, itemId };
      }

      // Send to server
      await api.delete(API_CONFIG.ENDPOINTS.LISTS.ITEMS.SINGLE(listId, itemId));
      return { listId, itemId };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete list item');
    }
  }
);

export const reorderListItem = createAsyncThunk(
  'lists/reorderListItems',
  async ({ 
    listId, 
    itemId, 
    newPosition 
  }: { 
    listId: string, 
    itemId: string, 
    newPosition: number 
  }, { rejectWithValue }) => {
    try {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;

      // Update local storage first
      const storedLists = await storage.getLists() || [];
      const targetList = storedLists.find(list => list._id === listId);

      if (!targetList) {
        return rejectWithValue('List not found');
      }

      // Reorder items locally
      const items = [...targetList.items];
      const itemIndex = items.findIndex(item => item._id === itemId);
      const [movedItem] = items.splice(itemIndex, 1);
      items.splice(newPosition, 0, movedItem);

      // Update positions
      const updatedItems = items.map((item: ListItem, index) => ({
        ...item,
        position: index,
        updatedAt: new Date().toISOString()
      }));

      const updatedList = {
        ...targetList,
        items: updatedItems,
        updatedAt: new Date().toISOString()
      };

      await storage.saveLists(storedLists.map(list =>
        list._id === listId ? updatedList : list
      ));

      if (!isConnected) {
        await syncService.addPendingChange(ACTION_TYPES.REORDER_LIST_ITEMS, listId, { 
          itemId, 
          newPosition 
        });
        return { listId, items: updatedItems };
      }

      // Send to server
      const response = await api.patch(API_CONFIG.ENDPOINTS.LISTS.ITEMS.REORDER(listId, itemId), {
        newPosition
      });

      // Update local storage with server response
      const serverUpdatedItems = response.data;
      const currentLists = await storage.getLists() || [];
      const finalList = currentLists.find(list => list._id === listId);
      
      if (finalList) {
        finalList.items = serverUpdatedItems;
        await storage.saveLists(currentLists.map(list =>
          list._id === listId ? finalList : list
        ));
      }

      return { listId, items: serverUpdatedItems };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reorder list items');
    }
  }
); 