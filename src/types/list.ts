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

export interface List {
  _id: string;
  title: string;
  items: ListItem[];
  owner: ListOwner | string;
  sharedWith: SharedUser[];
  createdAt: string;
  updatedAt: string;
  shared?: boolean;
  isTemp?: boolean;
  pendingSync?: boolean;
  version?: number;
  localVersion?: number;
}

export interface ListsState {
  lists: List[];
  currentList: List | null;
  loading: boolean;
  error: string | null;
} 