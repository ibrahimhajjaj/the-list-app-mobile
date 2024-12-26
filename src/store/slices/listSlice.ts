import { createSlice } from '@reduxjs/toolkit';
import { fetchLists, createList, updateListItem, deleteListItem, deleteList } from '../actions/listActions';
import { List, ListsState } from '../../types/list';
import {
  setLists,
  setCurrentList,
  addList,
  updateListInStore,
  setLoading,
  setError,
} from '../actions/listActionCreators';

const initialState: ListsState = {
  lists: [],
  currentList: null,
  loading: false,
  error: null,
};

const listSlice = createSlice({
  name: 'lists',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(setLists, (state, action) => {
        state.lists = action.payload.map(list => ({
          ...list,
          shared: list.sharedWith.length > 0
        }));
      })
      .addCase(setCurrentList, (state, action) => {
        state.currentList = {
          ...action.payload,
          shared: action.payload.sharedWith.length > 0
        };
      })
      .addCase(addList, (state, action) => {
        const newList = {
          ...action.payload,
          shared: action.payload.sharedWith.length > 0
        };
        state.lists.push(newList);
      })
      .addCase(updateListInStore, (state, action) => {
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
      .addCase(setLoading, (state, action) => {
        state.loading = action.payload;
      })
      .addCase(setError, (state, action) => {
        state.error = action.payload;
      })
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

export default listSlice.reducer; 