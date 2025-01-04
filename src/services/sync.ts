import { databaseService } from './database';
import api from './api';
import { store, updateListInStore } from '../store';
import { List } from '../types/list';
import { storage } from './storage';
import { conflictResolutionService } from './conflictResolution';

// Define status types enum for better type safety and maintainability
enum SyncStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Define action types enum for better type safety and maintainability
enum ActionType {
  CREATE = 'CREATE_LIST',
  UPDATE = 'UPDATE_LIST',
  DELETE = 'DELETE_LIST'
}

interface PendingChange {
  id: number;
  actionType: ActionType;
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
  async addPendingChange(actionType: ActionType, entityId: string, data: any) {
    await databaseService.addPendingChange(actionType, entityId, data);
    
    const state = store.getState();
    const isConnected = state.network.isConnected && state.network.isInternetReachable;
    
    if (isConnected) {
      this.processPendingChanges();
    }
  }

  // Sort changes by operation type priority
  private sortChangesByPriority(changes: PendingChange[]): PendingChange[] {
    const createChanges = changes.filter(c => c.actionType === ActionType.CREATE);
    const updateChanges = changes.filter(c => c.actionType === ActionType.UPDATE);
    const deleteChanges = changes.filter(c => c.actionType === ActionType.DELETE);

    return [...createChanges, ...updateChanges, ...deleteChanges];
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
   * Routes the change to the appropriate handler based on the action type
   * (create, update, or delete).
   * 
   * @param change - The change operation to process
   */
  private async processChange(change: PendingChange) {
    switch (change.actionType) {
      case ActionType.CREATE:
        await this.processCreateList(change);
        break;
      case ActionType.UPDATE:
        await this.processUpdateList(change);
        break;
      case ActionType.DELETE:
        await this.processDeleteList(change);
        break;
      default:
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
    const localList = lists.find(list => list._id === entityId);

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
}

// Export only the singleton instance
export default new SyncService(); 