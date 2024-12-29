import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { List } from '../../types/list';
import { 
  fetchLists, 
  createList, 
  updateList, 
  deleteList,
  shareList,
  unshareList,
  updateListItem,
  deleteListItem,
  fetchListById
} from '../actions/listActions';
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
        shared: list.sharedWith.length > 0
      }));
      state.error = null;
    },
    setCurrentList: (state, action: PayloadAction<List>) => {
      state.currentList = {
        ...action.payload,
        shared: action.payload.sharedWith.length > 0
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
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLists.fulfilled, (state, action: PayloadAction<List[]>) => {
        state.lists = action.payload.map(list => ({
          ...list,
          shared: list.sharedWith.length > 0
        }));
        state.loading = false;
        state.error = null;
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
          shared: action.payload.sharedWith.length > 0
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
          shared: action.payload.sharedWith.length > 0
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

    // Delete List
    builder
      .addCase(deleteList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteList.fulfilled, (state, action: PayloadAction<string>) => {
        state.lists = state.lists.filter(list => list._id !== action.payload);
        if (state.currentList?._id === action.payload) {
          state.currentList = null;
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(deleteList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to delete list';
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
            shared: action.payload.sharedWith.length > 0
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
            shared: action.payload.sharedWith.length > 0
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
      .addCase(updateListItem.fulfilled, (state, action: PayloadAction<List>) => {
        const updatedList = {
          ...action.payload,
          shared: action.payload.sharedWith.length > 0
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
        state.currentList = action.payload;
        const index = state.lists.findIndex(list => list._id === action.payload._id);
        if (index !== -1) {
          state.lists[index] = action.payload;
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchListById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to fetch list';
      });
  },
});

export const { setLists, setCurrentList, setLoading, setError, clearError } = listSlice.actions;
export default listSlice.reducer; 