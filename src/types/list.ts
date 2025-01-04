export interface ListOwner {
  _id: string;
  email: string;
  name?: string;
}

export interface ListItem {
  _id: string;
  text: string;
  completed: boolean;
  position?: number;
  createdAt?: string;
  updatedAt?: string;
  isTemp?: boolean;
}

export interface SharedUser {
  user: string;
  permission: 'view' | 'edit';
  _id?: string;
}

// Define allowed update fields
export type AllowedListUpdates = {
  title?: string;
  items?: ListItem[];
  category?: string;
};

export interface List {
  _id: string;
  title: string;
  items: ListItem[];
  pendingSync: boolean;
  isTemp?: boolean;
  shared?: boolean;
  createdAt: string;
  updatedAt: string;
  __v: number;
  localVersion: number;
  category?: string;
  owner?: string;
  sharedWith?: string[];
}

export interface ListsState {
  lists: List[];
  currentList: List | null;
  loading: boolean;
  error: string | null;
}

// Action types for sync service
export const ACTION_TYPES = {
  CREATE_LIST: 'CREATE_LIST',
  UPDATE_LIST: 'UPDATE_LIST',
  DELETE_LIST: 'DELETE_LIST',
  SHARE_LIST: 'SHARE_LIST',
  UNSHARE_LIST: 'UNSHARE_LIST',
  ADD_LIST_ITEM: 'ADD_LIST_ITEM',
  UPDATE_LIST_ITEM: 'UPDATE_LIST_ITEM',
  DELETE_LIST_ITEM: 'DELETE_LIST_ITEM',
  REORDER_LIST_ITEMS: 'REORDER_LIST_ITEMS'
} as const;

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES]; 