import { List } from '../../types/list';

// Action types
export const SYNC_ACTIONS = {
  START_SYNC: 'sync/startSync',
  STOP_SYNC: 'sync/stopSync',
  SYNC_COMPLETED: 'sync/syncCompleted',
  SYNC_FAILED: 'sync/syncFailed',
  UPDATE_NETWORK_STATUS: 'network/setNetworkState',
  LIST_UPDATED: 'sync/listUpdated'
} as const;

// Payload types
export interface SyncCompletedPayload {
  type: string;
  listId: string;
}

export interface SyncFailedPayload {
  error: Error;
  type?: string;
  listId?: string;
}

// Action creators
export const syncActions = {
  startSync: () => ({ 
    type: SYNC_ACTIONS.START_SYNC,
    payload: undefined
  }),
  stopSync: () => ({ 
    type: SYNC_ACTIONS.STOP_SYNC,
    payload: undefined
  }),
  syncCompleted: (data: SyncCompletedPayload) => ({ 
    type: SYNC_ACTIONS.SYNC_COMPLETED, 
    payload: data 
  }),
  syncFailed: (error: Error) => ({ 
    type: SYNC_ACTIONS.SYNC_FAILED, 
    payload: { error } as SyncFailedPayload
  }),
  listUpdated: (list: List) => ({
    type: SYNC_ACTIONS.LIST_UPDATED,
    payload: list
  })
}; 