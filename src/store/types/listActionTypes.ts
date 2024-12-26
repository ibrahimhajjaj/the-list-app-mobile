import { List } from '../../types/list';

export interface DeleteListPayload {
  deletedId: string;
}

export interface DeleteListItemPayload {
  listId: string;
  itemId: string;
}

export interface ShareListPayload {
  listId: string;
  data: {
    email: string;
    permission: 'view' | 'edit';
  };
}

export interface UpdateListItemPayload {
  listId: string;
  itemId: string;
  updates: Partial<List['items'][0]>;
} 