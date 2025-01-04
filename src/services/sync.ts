import { databaseService } from './database';
import api from './api';
import { store, updateListInStore } from '../store';
import { List, ListItem } from '../types/list';
import { storage } from './storage';
import { conflictResolutionService } from './conflictResolution';
import { ACTION_TYPES } from '../types/list';
import { API_CONFIG } from '../config/api';
import { fetchLists } from '../store/actions/listActions';

// Define status types enum for better type safety and maintainability
enum SyncStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Define action types for internal use
type ListActionType = typeof ACTION_TYPES.CREATE_LIST | 
  typeof ACTION_TYPES.UPDATE_LIST | 
  typeof ACTION_TYPES.DELETE_LIST |
  typeof ACTION_TYPES.SHARE_LIST |
  typeof ACTION_TYPES.UNSHARE_LIST;

type ListItemActionType = typeof ACTION_TYPES.ADD_LIST_ITEM | 
  typeof ACTION_TYPES.UPDATE_LIST_ITEM | 
  typeof ACTION_TYPES.DELETE_LIST_ITEM | 
  typeof ACTION_TYPES.REORDER_LIST_ITEMS;

type SyncActionType = ListActionType | ListItemActionType;

interface PendingChange {
  id: number;
  actionType: SyncActionType;
  entityId: string;
  data: any;
  timestamp: number;
  retries: number;
  status: string;
  originalEntityId?: string;
}

interface IDMapping {
  tempId: string;
  actualId: string;
  status: SyncStatus;
  createdAt: number; // Timestamp when the mapping was created
}

class SyncService {
  private isProcessing: boolean = false;
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 5;
  private readonly MAPPING_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private syncInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private idMappings: Map<string, IDMapping> = new Map();

  constructor() {
    this.initializeIdMappings();
    this.startCleanupInterval();
  }

  // Initialize ID mappings from database
  private async initializeIdMappings() {
    try {
      const mappings = await databaseService.getAllIdMappings();
      this.idMappings.clear();
      
      const now = Date.now();
      mappings.forEach(mapping => {
        const idMapping: IDMapping = {
          tempId: mapping.tempId,
          actualId: mapping.actualId,
          status: mapping.status as SyncStatus,
          createdAt: now // Always use current time for existing mappings for safety
        };
        this.idMappings.set(mapping.tempId, idMapping);
        this.idMappings.set(mapping.actualId, idMapping);
      });

      // Clean up expired mappings on initialization
      await this.cleanupExpiredMappings();
    } catch (error) {
      throw error;
    }
  }

  // Start the cleanup interval
  private startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredMappings();
    }, this.CLEANUP_INTERVAL);
  }

  // Stop the cleanup interval
  private stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Cleanup expired mappings
  private async cleanupExpiredMappings() {
    const now = Date.now();
    const expiredMappings: string[] = [];
    const pendingChanges = await databaseService.getPendingChanges() as PendingChange[];
    
    // Create a set of entityIds that have pending changes for quick lookup
    const entityIdsWithPendingChanges = new Set(pendingChanges.map(change => change.entityId));

    // Identify mappings that can be safely removed
    this.idMappings.forEach((mapping, key) => {
      const hasExpiredTime = now - mapping.createdAt > this.MAPPING_TTL;
      const hasPendingChanges = entityIdsWithPendingChanges.has(mapping.tempId) || 
                               entityIdsWithPendingChanges.has(mapping.actualId);
      
      // Only remove mapping if:
      // 1. It has exceeded TTL AND
      // 2. It's in COMPLETED or FAILED status (not PENDING) AND
      // 3. It has no pending changes associated with it
      if (hasExpiredTime && 
          mapping.status !== SyncStatus.PENDING && 
          !hasPendingChanges) {
        expiredMappings.push(key);
      }
    });

    // Remove safe-to-delete mappings
    for (const key of expiredMappings) {
      this.idMappings.delete(key);
      await databaseService.removeIdMapping(key);
    }
  }

  // Start periodic sync with specified interval
  startPeriodicSync(intervalMs: number = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      const state = store.getState();
      const isConnected = state.network.isConnected && state.network.isInternetReachable;
      
      if (isConnected) {
        this.processPendingChanges();
      }
    }, intervalMs);

    // Initial sync on start if connected
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

  // Add a new change to the pending changes queue
  async addPendingChange(actionType: SyncActionType, entityId: string, data: any) {
    console.log('[Sync] Adding pending change:', {
      actionType,
      entityId,
      data
    });

    // For updates or deletions of temporary items, modify the original ADD_LIST_ITEM change
    if ((actionType === ACTION_TYPES.UPDATE_LIST_ITEM || actionType === ACTION_TYPES.DELETE_LIST_ITEM) && 
        data.itemId.startsWith('temp_')) {
      const pendingChanges = await databaseService.getPendingChanges();
      const originalChange = pendingChanges.find(change => 
        change.actionType === ACTION_TYPES.ADD_LIST_ITEM &&
        change.entityId === entityId &&
        change.data.items.some((item: ListItem) => item._id === data.itemId)
      );

      if (originalChange) {
        console.log('[Sync] Found original add change for temp item:', {
          changeId: originalChange.id,
          itemId: data.itemId
        });

        if (actionType === ACTION_TYPES.DELETE_LIST_ITEM) {
          // Remove the item from the original change
          const updatedItems = originalChange.data.items.filter((item: ListItem) => 
            item._id !== data.itemId
          );

          console.log('[Sync] Removing item from original change:', {
            itemId: data.itemId,
            remainingItems: updatedItems.length
          });

          if (updatedItems.length === 0) {
            // If no items left, remove the entire change
            await databaseService.removePendingChange(originalChange.id);
            console.log('[Sync] Removed empty add change');
          } else {
            // Update the change with remaining items
            await databaseService.updatePendingChange(originalChange.id, {
              ...originalChange,
              data: { ...originalChange.data, items: updatedItems }
            });
            console.log('[Sync] Updated original change with remaining items');
          }
        } else {
          // Update the item in the original change
          const updatedItems = originalChange.data.items.map((item: ListItem) =>
            item._id === data.itemId ? { ...item, ...data.updates } : item
          );

          console.log('[Sync] Updating original change with modified items:', {
            itemCount: updatedItems.length,
            itemIds: updatedItems.map((i: ListItem) => i._id)
          });

          await databaseService.updatePendingChange(originalChange.id, {
            ...originalChange,
            data: { ...originalChange.data, items: updatedItems }
          });
        }
        return;
      }
    }

    // For all other cases, proceed with adding a new pending change
    await databaseService.addPendingChange(actionType, entityId, data);
    
    const state = store.getState();
    const isConnected = state.network.isConnected && state.network.isInternetReachable;
    
    if (isConnected) {
      this.processPendingChanges();
    }
  }

  // Sort changes by operation type priority
  private sortChangesByPriority(changes: PendingChange[]): PendingChange[] {
    const listChanges = changes.filter(c => [
      ACTION_TYPES.CREATE_LIST,
      ACTION_TYPES.UPDATE_LIST,
      ACTION_TYPES.DELETE_LIST,
      ACTION_TYPES.SHARE_LIST,
      ACTION_TYPES.UNSHARE_LIST
    ].includes(c.actionType as ListActionType));

    const itemChanges = changes.filter(c => [
      ACTION_TYPES.ADD_LIST_ITEM,
      ACTION_TYPES.UPDATE_LIST_ITEM,
      ACTION_TYPES.DELETE_LIST_ITEM,
      ACTION_TYPES.REORDER_LIST_ITEMS
    ].includes(c.actionType as ListItemActionType));

    return [...listChanges, ...itemChanges];
  }

  // Process all pending changes
  async processPendingChanges() {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      const pendingChanges = await databaseService.getPendingChanges() as PendingChange[];
      
      // Group changes by entity and sort by operation type
      const changesByEntity = this.groupChangesByEntity(pendingChanges);

      // Process each entity's changes in sequence
      for (const [entityId, changes] of changesByEntity) {
        try {
          await this.processEntityChanges(entityId, changes);
          
          // After successful sync, cleanup any temp lists and mappings
          const mapping = this.idMappings.get(entityId);
          if (mapping && mapping.status === SyncStatus.COMPLETED) {
            await this.cleanupAfterSync(mapping.tempId, mapping.actualId);
          }
        } catch (error) {
          await this.markDependentChangesFailed(entityId, changes);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Group changes by entity ID and sort them by priority
  private groupChangesByEntity(changes: PendingChange[]): Map<string, PendingChange[]> {
    const groups = new Map<string, PendingChange[]>();
    
    for (const change of changes) {
      const existing = groups.get(change.entityId) || [];
      groups.set(change.entityId, [...existing, change]);
    }

    for (const [entityId, entityChanges] of groups) {
      groups.set(entityId, this.sortChangesByPriority(entityChanges));
    }

    return groups;
  }

  /**
   * Process all changes for a specific entity in sequence.
   * This ensures that operations on the same entity are handled in the correct order
   * (e.g., create before update, update before delete).
   * Changes are processed in batches defined by BATCH_SIZE to prevent overwhelming the system.
   * 
   * @param entityId - The ID of the entity being processed
   * @param changes - Array of changes to process for this entity
   */
  private async processEntityChanges(entityId: string, changes: PendingChange[]) {
    try {
      // Process changes in batches
      for (let i = 0; i < changes.length; i += this.BATCH_SIZE) {
        const batch = changes.slice(i, i + this.BATCH_SIZE);
        
        // Process each change in the current batch sequentially
        for (const change of batch) {
          await this.processChange(change);
        }
        
        // Optional: Add a small delay between batches to prevent rate limiting
        if (i + this.BATCH_SIZE < changes.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a single change operation based on its action type.
   * Routes the change to the appropriate handler based on the action type.
   * 
   * @param change - The change operation to process
   */
  private async processChange(change: PendingChange) {
    const isListAction = [
      ACTION_TYPES.CREATE_LIST,
      ACTION_TYPES.UPDATE_LIST,
      ACTION_TYPES.DELETE_LIST,
      ACTION_TYPES.SHARE_LIST,
      ACTION_TYPES.UNSHARE_LIST
    ].includes(change.actionType as ListActionType);

    const isItemAction = [
      ACTION_TYPES.ADD_LIST_ITEM,
      ACTION_TYPES.UPDATE_LIST_ITEM,
      ACTION_TYPES.DELETE_LIST_ITEM,
      ACTION_TYPES.REORDER_LIST_ITEMS
    ].includes(change.actionType as ListItemActionType);

    if (isListAction) {
      switch (change.actionType as ListActionType) {
        case ACTION_TYPES.CREATE_LIST:
        await this.processCreateList(change);
        break;
        case ACTION_TYPES.UPDATE_LIST:
        await this.processUpdateList(change);
        break;
        case ACTION_TYPES.DELETE_LIST:
        await this.processDeleteList(change);
        break;
        case ACTION_TYPES.SHARE_LIST:
          await this.processShareList(change);
          break;
        case ACTION_TYPES.UNSHARE_LIST:
          await this.processUnshareList(change);
          break;
      }
    } else if (isItemAction) {
      switch (change.actionType as ListItemActionType) {
        case ACTION_TYPES.ADD_LIST_ITEM:
          await this.processAddListItems(change);
          break;
        case ACTION_TYPES.UPDATE_LIST_ITEM:
          await this.processUpdateListItem(change);
          break;
        case ACTION_TYPES.DELETE_LIST_ITEM:
          await this.processDeleteListItem(change);
          break;
        case ACTION_TYPES.REORDER_LIST_ITEMS:
          await this.processReorderListItem(change);
          break;
      }
    } else {
        throw new Error(`Unknown action type: ${change.actionType}`);
    }
  }

  // Clean up temporary data after successful sync
  private async cleanupAfterSync(tempId: string, actualId: string) {
    try {
      const storedLists = await storage.getLists();
      
      // Remove the temporary list while keeping the actual one
      const updatedLists = storedLists.filter((list: List) => 
        list._id !== tempId || list._id === actualId
      );

      await storage.saveLists(updatedLists);
      await databaseService.removeIdMapping(tempId);
    } catch (error) {
      throw error;
    }
  }

  // Process list creation
  private async processCreateList(change: PendingChange) {
    try {
      const response = await api.post('/lists', change.data);
      const newList = response.data;
      
      const newMapping = {
        tempId: change.entityId,
        actualId: newList._id,
        status: SyncStatus.COMPLETED,
        createdAt: Date.now()
      };

      await Promise.all([
        (async () => {
          this.idMappings.set(change.entityId, newMapping);
          this.idMappings.set(newList._id, newMapping);
          await databaseService.saveIdMapping(change.entityId, newList._id, SyncStatus.COMPLETED);
        })(),
        store.dispatch(updateListInStore(newList)),
        databaseService.removePendingChange(change.id)
      ]);

      await this.cleanupAfterSync(change.entityId, newList._id);
    } catch (error) {
      throw error;
    }
  }

  // Get actual ID from temporary ID using mappings
  private getActualId(entityId: string): string {
    const mapping = this.idMappings.get(entityId);
    return mapping ? mapping.actualId : entityId;
  }

  // Process list update
  private async processUpdateList(change: PendingChange) {
    try {
      const actualId = this.getActualId(change.entityId);
      
      try {
        const response = await api.patch(`/lists/${actualId}`, change.data);
        
        await Promise.all([
          store.dispatch(updateListInStore(response.data)),
          databaseService.removePendingChange(change.id)
        ]);
      } catch (error: any) {
        // Handle conflict (409) responses
        if (error.response?.status === 409) {
          const serverList = error.response.data.serverData;
          const mergedData = await this.handleConflict(change.entityId, serverList, error.response.data.conflictType);

          const retryResponse = await api.patch(`/lists/${actualId}`, mergedData);
          
          await Promise.all([
            store.dispatch(updateListInStore(retryResponse.data)),
            databaseService.removePendingChange(change.id)
          ]);
        } else {
          throw error;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  // Process list deletion
  private async processDeleteList(change: PendingChange) {
    try {
      const actualId = this.getActualId(change.entityId);
      
      await Promise.all([
        api.delete(`/lists/${actualId}`),
        databaseService.removePendingChange(change.id)
      ]);
    } catch (error) {
      throw error;
    }
  }

  // Mark dependent changes as failed when an error occurs
  private async markDependentChangesFailed(entityId: string, changes: PendingChange[]) {
    for (const change of changes) {
      await Promise.all([
        databaseService.updatePendingChangeStatus(change.id, SyncStatus.FAILED),
        databaseService.updateIdMappingStatus(change.entityId, SyncStatus.FAILED)
      ]);
    }
  }

  // Handle conflicts between local and server data
  async handleConflict(entityId: string, serverData: any, conflictType: string) {
    const lists = await storage.getLists();
    const localList = lists?.find(list => list._id === entityId);

    if (!localList) {
      return serverData;
    }

    try {
      return await conflictResolutionService.resolveListConflict(
        localList,
        serverData,
        conflictType
      );
    } catch (error) {
      return serverData;
    }
  }

  // Override dispose/cleanup method
  dispose() {
    this.stopPeriodicSync();
    this.stopCleanupInterval();
    this.idMappings.clear();
  }

  // Process list item addition
  private async processAddListItems(change: PendingChange) {
    try {
      console.log('[Sync] Processing add items:', {
        listId: change.entityId,
        items: change.data.items,
        tempIds: change.data.items.map((i: ListItem) => i._id)
      });

      const response = await api.post(API_CONFIG.ENDPOINTS.LISTS.ITEMS.BASE(change.entityId), change.data);
      const newItems = response.data;
      
      console.log('[Sync] Server response items:', {
        newItems,
        newItemIds: newItems.map((i: ListItem) => i._id)
      });
      
      const currentLists = await storage.getLists() || [];
      const targetList = currentLists.find(list => list._id === change.entityId);
      
      if (targetList) {
        console.log('[Sync] Current list state before update:', {
          listId: targetList._id,
          itemCount: targetList.items.length,
          itemIds: targetList.items.map((i: ListItem) => i._id)
        });

        // Replace temporary items with server response
        targetList.items = [
          ...targetList.items.filter((item: ListItem) => 
            !change.data.items.some((temp: ListItem) => temp._id === item._id)
          ),
          ...newItems
        ];

        console.log('[Sync] Updated list state:', {
          listId: targetList._id,
          itemCount: targetList.items.length,
          itemIds: targetList.items.map((i: ListItem) => i._id)
        });

        await storage.saveLists(currentLists.map(list =>
          list._id === change.entityId ? targetList : list
        ));

        // Update Redux store with the new items
        console.log('[Sync] Dispatching store update with list:', {
          listId: targetList._id,
          itemCount: targetList.items.length,
          itemIds: targetList.items.map((i: ListItem) => i._id)
        });

        store.dispatch(updateListInStore({
          ...targetList,
          items: targetList.items
        }));

        // Fetch fresh lists to ensure UI is up to date
        console.log('[Sync] Fetching fresh lists after sync');
        store.dispatch(fetchLists());
      }

      await databaseService.removePendingChange(change.id);
      console.log('[Sync] Add items process completed');
    } catch (error) {
      console.error('[Sync] Error processing add items:', error);
      throw error;
    }
  }

  // Process list item update
  private async processUpdateListItem(change: PendingChange) {
    try {
      const { itemId, updates } = change.data;
      
      console.log('[Sync] Processing update item:', {
        listId: change.entityId,
        itemId,
        updates,
        isTemp: itemId.startsWith('temp_')
      });

      // If the item has a temporary ID, just update it in local storage
      if (itemId.startsWith('temp_')) {
        console.log('[Sync] Handling temporary item update');
        const currentLists = await storage.getLists() || [];
        const targetList = currentLists.find(list => list._id === change.entityId);
        
        if (targetList) {
          console.log('[Sync] Current list state before update:', {
            listId: targetList._id,
            itemCount: targetList.items.length,
            itemIds: targetList.items.map((i: ListItem) => i._id)
          });

          targetList.items = targetList.items.map((item: ListItem) =>
            item._id === itemId ? { ...item, ...updates } : item
          );

          console.log('[Sync] Updated list state:', {
            listId: targetList._id,
            itemCount: targetList.items.length,
            itemIds: targetList.items.map((i: ListItem) => i._id)
          });

          await storage.saveLists(currentLists.map(list =>
            list._id === change.entityId ? targetList : list
          ));
          console.log('[Sync] Saved updated list to storage');
        }
      } else {
        console.log('[Sync] Handling non-temporary item update');
        // Only send update request to server for non-temporary items
        const response = await api.patch(API_CONFIG.ENDPOINTS.LISTS.ITEMS.SINGLE(change.entityId, itemId), updates);
        const updatedItem = response.data;

        console.log('[Sync] Server response:', {
          itemId: updatedItem._id,
          updates: updatedItem
        });

        const currentLists = await storage.getLists() || [];
        const targetList = currentLists.find(list => list._id === change.entityId);
        
        if (targetList) {
          console.log('[Sync] Current list state before update:', {
            listId: targetList._id,
            itemCount: targetList.items.length,
            itemIds: targetList.items.map((i: ListItem) => i._id)
          });

          targetList.items = targetList.items.map((item: ListItem) =>
            item._id === itemId ? updatedItem : item
          );

          console.log('[Sync] Updated list state:', {
            listId: targetList._id,
            itemCount: targetList.items.length,
            itemIds: targetList.items.map((i: ListItem) => i._id)
          });

          await storage.saveLists(currentLists.map(list =>
            list._id === change.entityId ? targetList : list
          ));
          console.log('[Sync] Saved updated list to storage');
        }
      }

      await databaseService.removePendingChange(change.id);
      console.log('[Sync] Update item process completed');
    } catch (error) {
      console.error('[Sync] Error processing update item:', error);
      throw error;
    }
  }

  // Process list item deletion
  private async processDeleteListItem(change: PendingChange) {
    try {
      const { itemId } = change.data;
      
      // If the item has a temporary ID, just remove it from local storage
      if (itemId.startsWith('temp_')) {
        const currentLists = await storage.getLists() || [];
        const targetList = currentLists.find(list => list._id === change.entityId);
        
        if (targetList) {
          targetList.items = targetList.items.filter((item: ListItem) => item._id !== itemId);
          await storage.saveLists(currentLists.map(list =>
            list._id === change.entityId ? targetList : list
          ));
        }
      } else {
        // Only send delete request to server for non-temporary items
        await api.delete(API_CONFIG.ENDPOINTS.LISTS.ITEMS.SINGLE(change.entityId, itemId));
      }

      await databaseService.removePendingChange(change.id);
    } catch (error) {
      throw error;
    }
  }

  // Process list item reordering
  private async processReorderListItem(change: PendingChange) {
    try {
      const { itemId, newPosition } = change.data;
      const response = await api.patch(API_CONFIG.ENDPOINTS.LISTS.ITEMS.REORDER(change.entityId, itemId), {
        newPosition
      });
      const updatedItems = response.data;

      const currentLists = await storage.getLists() || [];
      const targetList = currentLists.find(list => list._id === change.entityId);
      
      if (targetList) {
        targetList.items = updatedItems;
        await storage.saveLists(currentLists.map(list =>
          list._id === change.entityId ? targetList : list
        ));
      }

      await databaseService.removePendingChange(change.id);
    } catch (error) {
      throw error;
    }
  }

  // Process list sharing
  private async processShareList(change: PendingChange) {
    try {
      const actualId = this.getActualId(change.entityId);
      const response = await api.post(`${API_CONFIG.ENDPOINTS.LISTS.SHARE(actualId)}`, change.data);
      
      const currentLists = await storage.getLists() || [];
      const targetList = currentLists.find(list => list._id === change.entityId);
      
      if (targetList) {
        targetList.sharedWith = response.data.sharedWith;
        await storage.saveLists(currentLists.map(list =>
          list._id === change.entityId ? targetList : list
        ));
      }

      await databaseService.removePendingChange(change.id);
    } catch (error) {
      throw error;
    }
  }

  // Process list unsharing
  private async processUnshareList(change: PendingChange) {
    try {
      const actualId = this.getActualId(change.entityId);
      const response = await api.delete(`${API_CONFIG.ENDPOINTS.LISTS.SHARE(actualId)}`, { data: change.data });
      
      const currentLists = await storage.getLists() || [];
      const targetList = currentLists.find(list => list._id === change.entityId);
      
      if (targetList) {
        targetList.sharedWith = response.data.sharedWith;
        await storage.saveLists(currentLists.map(list =>
          list._id === change.entityId ? targetList : list
        ));
      }

      await databaseService.removePendingChange(change.id);
    } catch (error) {
      throw error;
    }
  }
}

const syncService = new SyncService();
export default syncService; 