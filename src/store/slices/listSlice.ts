import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { fetchLists, createList, updateListItem, deleteListItem, deleteList } from '../actions/listActions';

export interface ListItem {
  _id?: string;
  text: string;
  completed: boolean;
}

interface SharedUser {
  user: string;
  permission: 'view' | 'edit';
  _id?: string;
}

interface ListOwner {
  _id: string;
  name: string;
  email: string;
}

export interface List {
  _id: string;
  title: string;
  description?: string;
  items: ListItem[];
  owner: ListOwner;
  sharedWith: SharedUser[];
  createdAt: string;
  updatedAt: string;
  shared?: boolean;
}

interface ListsState {
  lists: List[];
  currentList: List | null;
  loading: boolean;
  error: string | null;
}

const initialState: ListsState = {
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
    },
    setCurrentList: (state, action: PayloadAction<List>) => {
      state.currentList = {
        ...action.payload,
        shared: action.payload.sharedWith.length > 0
      };
    },
    addList: (state, action: PayloadAction<List>) => {
      const newList = {
        ...action.payload,
        shared: action.payload.sharedWith.length > 0
      };
      state.lists.push(newList);
    },
    updateList: (state, action: PayloadAction<List>) => {
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
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLists.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLists.fulfilled, (state, action) => {
        state.loading = false;
        state.lists = action.payload.map(list => ({
          ...list,
          shared: list.sharedWith.length > 0
        }));
      })
      .addCase(fetchLists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch lists';
      })
      .addCase(createList.fulfilled, (state, action) => {
        const newList = {
          ...action.payload,
          shared: action.payload.sharedWith.length > 0
        };
        state.lists.push(newList);
      })
      .addCase(deleteList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteList.fulfilled, (state, action) => {
        state.loading = false;
        state.lists = state.lists.filter(list => list._id !== action.payload.deletedId);
        if (state.currentList?._id === action.payload.deletedId) {
          state.currentList = null;
        }
      })
      .addCase(deleteList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete list';
      })
      .addCase(updateListItem.fulfilled, (state, action) => {
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
      })
      .addCase(deleteListItem.fulfilled, (state, action) => {
        const { listId, itemId } = action.payload;
        const list = state.lists.find(l => l._id === listId);
        if (list) {
          list.items = list.items.filter(item => item._id !== itemId);
        }
        if (state.currentList?._id === listId) {
          state.currentList.items = state.currentList.items.filter(item => item._id !== itemId);
        }
      });
  },
});

export const {
  setLists,
  setCurrentList,
  addList,
  updateList,
  setLoading,
  setError,
} = listSlice.actions;

export default listSlice.reducer; 