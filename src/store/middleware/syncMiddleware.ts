import { Middleware, Action, AnyAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import syncService from '../../services/sync';
import { updateListInStore } from '../actions/listActionCreators';
import { SYNC_ACTIONS, syncActions } from '../actions/syncActions';
import { List } from '../../types/list';

const createSyncMiddleware = () => {
  return ((store) => {
    // Set dispatch when middleware is created
    syncService.setDispatch(store.dispatch);
    
    return (next) => (action: AnyAction) => {
      const result = next(action);
      
      if (action.type === SYNC_ACTIONS.START_SYNC) {
        const state = store.getState();
        const isConnected = state.network.isConnected && state.network.isInternetReachable;
        
        if (isConnected) {
          syncService.startPeriodicSync();
        }
      }
      else if (action.type === SYNC_ACTIONS.STOP_SYNC) {
        syncService.stopPeriodicSync();
      }
      else if (action.type === SYNC_ACTIONS.UPDATE_NETWORK_STATUS) {
        const state = store.getState();
        const isConnected = Boolean(state.network.isConnected && state.network.isInternetReachable);
        
        // Update sync service network status
        syncService.setNetworkStatus(
          Boolean(state.network.isConnected), 
          Boolean(state.network.isInternetReachable)
        );
        
        if (isConnected) {
          syncService.processPendingChanges().catch(error => {
            if (error instanceof Error) {
              store.dispatch(syncActions.syncFailed(error));
            } else {
              store.dispatch(syncActions.syncFailed(new Error('Unknown error during sync')));
            }
          });
        }
      }
      else if (action.type === SYNC_ACTIONS.LIST_UPDATED && 'payload' in action) {
        store.dispatch(updateListInStore(action.payload as List));
      }

      return result;
    };
  }) as Middleware;
};

export const syncMiddleware = createSyncMiddleware(); 