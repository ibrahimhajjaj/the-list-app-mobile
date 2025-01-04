import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { List, ListItem } from '../../types/list';
import { 
  fetchLists, 
  createList, 
  updateList, 
  deleteList,
  shareList,
  unshareList,
  fetchListById,
  updateListInStore
} from '../actions/listActions';
import {
  updateListItem,
  deleteListItem,
  addListItems
} from '../actions/listItemActions';
import { DeleteListItemPayload } from '../types/listActionTypes';

interface ListState {
  lists: List[];
  currentList: List | null;
  loading: boolean;
  error: string | null;
}

const initialState: ListState = {
  lists: [],
  currentList: null,
  loading: false,
  error: null,
};

const listSlice = createSlice({
  name: 'lists',
  initialState,
  reducers: {
    setLists: (state, action: PayloadAction<List[]>) => {
      state.lists = action.payload.map(list => ({
        ...list,
        shared: Boolean(list.sharedWith?.length)
      }));
      state.error = null;
    },
    setCurrentList: (state, action: PayloadAction<List>) => {
      state.currentList = {
        ...action.payload,
        shared: Boolean(action.payload.sharedWith?.length)
      };
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Lists
    builder
      .addCase(fetchLists.pending, (state) => {
        console.log('[ListSlice] Fetching lists...');
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLists.fulfilled, (state, action: PayloadAction<List[]>) => {
        console.log('[ListSlice] Lists fetched:', {
          count: action.payload.length,
          listIds: action.payload.map(l => l._id)
        });
        state.lists = action.payload.map(list => ({
          ...list,
          shared: Boolean(list.sharedWith?.length)
        }));
        state.loading = false;
        state.error = null;

        // If we have a current list, update it with fresh data
        if (state.currentList) {
          const updatedCurrentList = action.payload.find(l => l._id === state.currentList?._id);
          if (updatedCurrentList) {
            state.currentList = {
              ...updatedCurrentList,
              shared: Boolean(updatedCurrentList.sharedWith?.length)
            };
            console.log('[ListSlice] Updated current list after fetch:', {
              listId: state.currentList._id,
              itemCount: state.currentList.items.length,
              itemIds: state.currentList.items.map(i => i._id)
            });
          }
        }
      })
      .addCase(fetchLists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch lists';
      });

    // Create List
    builder
      .addCase(createList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createList.fulfilled, (state, action: PayloadAction<List>) => {
        const newList = {
          ...action.payload,
          shared: Boolean(action.payload.sharedWith?.length)
        };
        state.lists.push(newList);
        state.loading = false;
        state.error = null;
      })
      .addCase(createList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to create list';
      });

    // Update List
    builder
      .addCase(updateList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateList.fulfilled, (state, action: PayloadAction<List>) => {
        const updatedList = {
          ...action.payload,
          shared: Boolean(action.payload.sharedWith?.length)
        };
        const index = state.lists.findIndex(list => list._id === updatedList._id);
        if (index !== -1) {
          state.lists[index] = updatedList;
        }
        if (state.currentList?._id === updatedList._id) {
          state.currentList = updatedList;
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(updateList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to update list';
      });

    // Share List
    builder
      .addCase(shareList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(shareList.fulfilled, (state, action: PayloadAction<List | null>) => {
        if (action.payload) {
          const updatedList = {
            ...action.payload,
            shared: Boolean(action.payload.sharedWith?.length)
          };
          const index = state.lists.findIndex(list => list._id === updatedList._id);
          if (index !== -1) {
            state.lists[index] = updatedList;
          }
          if (state.currentList?._id === updatedList._id) {
            state.currentList = updatedList;
          }
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(shareList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to share list';
      });

    // Unshare List
    builder
      .addCase(unshareList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(unshareList.fulfilled, (state, action: PayloadAction<List | null>) => {
        if (action.payload) {
          const updatedList = {
            ...action.payload,
            shared: Boolean(action.payload.sharedWith?.length)
          };
          const index = state.lists.findIndex(list => list._id === updatedList._id);
          if (index !== -1) {
            state.lists[index] = updatedList;
          }
          if (state.currentList?._id === updatedList._id) {
            state.currentList = updatedList;
          }
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(unshareList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to unshare list';
      });

    // Update List Item
    builder
      .addCase(updateListItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateListItem.fulfilled, (state, action) => {
        const { listId, item, itemId, updates } = action.payload;
        const listIndex = state.lists.findIndex(list => list._id === listId);
        
        if (listIndex !== -1) {
          const list = state.lists[listIndex];
          // Handle both server response and offline updates
          if (item) {
            // Server response case
            const itemIndex = list.items.findIndex(i => i._id === item._id);
            if (itemIndex !== -1) {
              list.items[itemIndex] = item;
            }
          } else if (itemId && updates) {
            // Offline update case
            const itemIndex = list.items.findIndex(i => i._id === itemId);
            if (itemIndex !== -1) {
              list.items[itemIndex] = {
                ...list.items[itemIndex],
                ...updates,
                updatedAt: new Date().toISOString()
              };
            }
          }
        }

        // Update currentList if it's the active list
        if (state.currentList?._id === listId) {
          if (item) {
            // Server response case
            const itemIndex = state.currentList.items.findIndex(i => i._id === item._id);
            if (itemIndex !== -1) {
              state.currentList.items[itemIndex] = item;
            }
          } else if (itemId && updates) {
            // Offline update case
            const itemIndex = state.currentList.items.findIndex(i => i._id === itemId);
            if (itemIndex !== -1) {
              state.currentList.items[itemIndex] = {
                ...state.currentList.items[itemIndex],
                ...updates,
                updatedAt: new Date().toISOString()
              };
            }
          }
        }

        state.loading = false;
        state.error = null;
      })
      .addCase(updateListItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to update list item';
      });

    // Delete List Item
    builder
      .addCase(deleteListItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteListItem.fulfilled, (state, action: PayloadAction<DeleteListItemPayload>) => {
        const listIndex = state.lists.findIndex(list => list._id === action.payload.listId);
        if (listIndex !== -1) {
          state.lists[listIndex].items = state.lists[listIndex].items.filter(
            item => item._id !== action.payload.itemId
          );
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(deleteListItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to delete list item';
      });

    // Fetch List By Id
    builder
      .addCase(fetchListById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchListById.fulfilled, (state, action: PayloadAction<List>) => {
        const fetchedList = {
          ...action.payload,
          shared: Boolean(action.payload.sharedWith?.length)
        };
        state.currentList = fetchedList;
        const index = state.lists.findIndex(list => list._id === fetchedList._id);
        if (index !== -1) {
          state.lists[index] = fetchedList;
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchListById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch list';
      });

    // Add List Items
    builder
      .addCase(addListItems.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addListItems.fulfilled, (state, action) => {
        const { listId, items } = action.payload;
        const listIndex = state.lists.findIndex(list => list._id === listId);
        if (listIndex !== -1) {
          state.lists[listIndex].items = [
            ...state.lists[listIndex].items,
            ...items
          ];
        }
        if (state.currentList?._id === listId) {
          state.currentList.items = [
            ...state.currentList.items,
            ...items
          ];
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(addListItems.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to add list items';
      });

    // Update List In Store (for sync updates)
    builder
      .addCase(updateListInStore, (state, action: PayloadAction<List>) => {
        console.log('[ListSlice] Updating list in store:', {
          listId: action.payload._id,
          itemCount: action.payload.items.length,
          itemIds: action.payload.items.map(i => i._id)
        });

        const updatedList = {
          ...action.payload,
          shared: Boolean(action.payload.sharedWith?.length)
        };
        const index = state.lists.findIndex(list => list._id === updatedList._id);
        if (index !== -1) {
          state.lists[index] = updatedList;
          console.log('[ListSlice] Updated lists array, new state:', {
            listId: updatedList._id,
            itemCount: updatedList.items.length,
            itemIds: updatedList.items.map(i => i._id),
            totalLists: state.lists.length
          });
        }
        if (state.currentList?._id === updatedList._id) {
          state.currentList = updatedList;
          console.log('[ListSlice] Updated current list:', {
            listId: updatedList._id,
            itemCount: updatedList.items.length,
            itemIds: updatedList.items.map(i => i._id)
          });
        }

        console.log('[ListSlice] Store update complete');
      });
  },
});

export const { setLists, setCurrentList, setLoading, setError, clearError } = listSlice.actions;
export default listSlice.reducer; 