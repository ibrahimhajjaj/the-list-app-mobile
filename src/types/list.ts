export interface ListOwner {
  _id: string;
  email: string;
  name?: string;
}

export interface ListItem {
  _id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
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