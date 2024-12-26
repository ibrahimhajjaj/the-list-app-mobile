import { createAction } from '@reduxjs/toolkit';
import { List } from '../../types/list';

export const setLists = createAction<List[]>('lists/setLists');
export const setCurrentList = createAction<List>('lists/setCurrentList');
export const addList = createAction<List>('lists/addList');
export const updateListInStore = createAction<List>('lists/updateList');
export const setLoading = createAction<boolean>('lists/setLoading');
export const setError = createAction<string | null>('lists/setError'); 