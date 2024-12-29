import { databaseService } from './database';
import api from './api';
import { store, updateListInStore } from '../store';
import { List, ListItem } from '../types/list';

interface SyncError extends Error {
  response?: {
    status: number;
    data?: {
      serverVersion?: number;
      conflictType?: 'UPDATE' | 'DELETE';
    };
  };
}

class SyncService {
  private isProcessing: boolean = false;
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 5;
  private readonly BASE_DELAY = 1000;
  private readonly MAX_DELAY = 30000;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // No need to set up network listener here as it's handled in RootNavigator
  }

  startPeriodicSync(intervalMs: number = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Start periodic sync
    this.syncInterval = setInterval(() => {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;
      
      if (isConnected) {
        this.processPendingChanges();
      }
    }, intervalMs);

    // Initial check for pending changes
    const state = store.getState();
    const isConnected = state.network.isConnected && state.network.isInternetReachable;
    if (isConnected) {
      this.processPendingChanges();
    }
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async addPendingChange(actionType: string, entityId: string, data: any) {
    await databaseService.addPendingChange(actionType, entityId, data);
    
    // Check network state from Redux store
    const state = store.getState();
    const isConnected = state.network.isConnected && state.network.isInternetReachable;
    
    if (isConnected) {
      this.processPendingChanges();
    }
  }

  private calculateBackoffDelay(retries: number): number {
    const delay = Math.min(
      this.BASE_DELAY * Math.pow(2, retries),
      this.MAX_DELAY
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  private async processPendingChanges() {
    if (this.isProcessing) return;

    const state = store.getState();
    const isConnected = state.network.isConnected && state.network.isInternetReachable;
    
    if (!isConnected) return;

    try {
      this.isProcessing = true;
      const pendingChanges = await databaseService.getPendingChanges();
      
      // Process changes in batches
      for (let i = 0; i < pendingChanges.length; i += this.BATCH_SIZE) {
        const batch = pendingChanges.slice(i, i + this.BATCH_SIZE);
        await Promise.all(batch.map(change => this.processChange(change)));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processChange(change: any) {
    try {
      switch (change.actionType) {
        case 'CREATE_LIST':
          await this.processCreateList(change);
          break;
        case 'UPDATE_LIST':
          await this.processUpdateList(change);
          break;
        case 'DELETE_LIST':
          await this.processDeleteList(change);
          break;
        default:
          console.warn(`Unknown action type: ${change.actionType}`);
          await databaseService.updatePendingChangeStatus(change.id, 'failed');
      }
    } catch (error: any) {
      console.error(`Error processing change ${change.id}:`, error);
      
      if (error.response?.status === 409) {
        try {
          await this.resolveConflict(change, error);
          return;
        } catch (mergeError) {
          console.error('[Sync] Failed to resolve conflict:', mergeError);
        }
      }
      
      if (change.retries >= this.MAX_RETRIES) {
        await databaseService.updatePendingChangeStatus(change.id, 'failed');
      } else {
        const nextRetry = change.retries + 1;
        await databaseService.updatePendingChangeStatus(
          change.id,
          'pending',
          nextRetry
        );
        
        // Apply exponential backoff
        const delay = this.calculateBackoffDelay(nextRetry);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the change
        await this.processChange({
          ...change,
          retries: nextRetry
        });
      }
    }
  }

  private async processCreateList(change: any) {
    try {
      const response = await api.post('/lists', change.data);
      store.dispatch(updateListInStore(response.data));
      await databaseService.removePendingChange(change.id);
    } catch (error: any) {
      // Check for conflict (list already exists)
      if (error.response?.status === 409) {
        console.log('[Sync] List already exists, resolving conflict...');
        const existingList = await api.get(`/lists/${change.data.tempId}`);
        store.dispatch(updateListInStore(existingList.data));
        await databaseService.removePendingChange(change.id);
      } else {
        throw error;
      }
    }
  }

  private async processUpdateList(change: any) {
    try {
      const response = await api.patch(`/lists/${change.entityId}`, change.data);
      store.dispatch(updateListInStore(response.data));
      await databaseService.removePendingChange(change.id);
    } catch (error: any) {
      // Check for conflict (list was updated by someone else)
      if (error.response?.status === 409) {
        console.log('[Sync] List was updated by someone else, fetching latest...');
        const latestList = await api.get(`/lists/${change.entityId}`);
        store.dispatch(updateListInStore(latestList.data));
        await databaseService.removePendingChange(change.id);
      } else {
        throw error;
      }
    }
  }

  private async processDeleteList(change: any) {
    try {
      await api.delete(`/lists/${change.entityId}`);
      await databaseService.removePendingChange(change.id);
    } catch (error: any) {
      // If list doesn't exist, consider it successfully deleted
      if (error.response?.status === 404) {
        await databaseService.removePendingChange(change.id);
      } else {
        throw error;
      }
    }
  }

  private async resolveConflict(change: any, error: SyncError) {
    const serverVersion = error.response?.data?.serverVersion;
    const conflictType = error.response?.data?.conflictType;

    if (!serverVersion) {
      throw new Error('Server did not provide version information');
    }

    // Get the latest version from server
    const latestList = await api.get(`/lists/${change.entityId}`);
    
    if (conflictType === 'DELETE') {
      // List was deleted on server, remove local version
      await databaseService.removePendingChange(change.id);
      return;
    }

    // Merge changes
    const mergedList = this.mergeChanges(
      latestList.data,
      change.data,
      change.baseVersion
    );

    // Update local storage with merged changes
    await databaseService.saveLists([mergedList]);
    store.dispatch(updateListInStore(mergedList));

    // Try to update server with merged changes
    try {
      const response = await api.patch(`/lists/${change.entityId}`, {
        ...mergedList,
        version: serverVersion
      });
      await databaseService.removePendingChange(change.id);
      store.dispatch(updateListInStore(response.data));
    } catch (error) {
      // If still conflicting, keep in pending changes
      console.warn('[Sync] Conflict persists after merge attempt');
      throw error;
    }
  }

  private mergeChanges(serverList: List, localChanges: Partial<List>, baseVersion: number) {
    const mergedList = { ...serverList };
    const serverVersion = serverList.version ?? 1; // Default to version 1 if undefined

    // If the base version matches the server's previous version,
    // we can safely apply our changes
    if (baseVersion === serverVersion - 1) {
      return { ...mergedList, ...localChanges };
    }

    // Otherwise, we need to do a three-way merge
    if (localChanges.items) {
      const serverItemMap = new Map(serverList.items.map((item: ListItem) => [item._id, item]));
      const mergedItems = localChanges.items.map((localItem: ListItem) => {
        const serverItem = serverItemMap.get(localItem._id);
        if (!serverItem) {
          // Item was added locally
          return localItem;
        }
        if (serverItem.updatedAt > localItem.updatedAt) {
          // Server has newer changes
          return serverItem;
        }
        // Local changes are newer
        return localItem;
      });

      // Add any server items that weren't in local changes
      serverList.items.forEach((serverItem: ListItem) => {
        if (!mergedItems.some((item: ListItem) => item._id === serverItem._id)) {
          mergedItems.push(serverItem);
        }
      });

      mergedList.items = mergedItems;
    }

    return {
      ...mergedList,
      version: serverVersion
    };
  }
}

export const syncService = new SyncService();
export default syncService; 