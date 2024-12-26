export interface ListItem {
  _id?: string;
  text: string;
  completed: boolean;
}

export interface SharedUser {
  user: string;
  permission: 'view' | 'edit';
  _id?: string;
}

export interface ListOwner {
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

export interface ListsState {
  lists: List[];
  currentList: List | null;
  loading: boolean;
  error: string | null;
} 