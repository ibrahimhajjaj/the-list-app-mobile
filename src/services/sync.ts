import { databaseService } from './database';
import api from './api';
import { store, updateListInStore } from '../store';
import { List } from '../types/list';
import { storage } from './storage';
import { conflictResolutionService } from './conflictResolution';

interface PendingChange {
  id: number;
  actionType: string;
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
  status: 'pending' | 'completed' | 'failed';
}

class SyncService {
  private isProcessing: boolean = false;
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 5;
  private syncInterval: NodeJS.Timeout | null = null;
  private idMappings: Map<string, IDMapping> = new Map();

  constructor() {
    this.initializeIdMappings();
  }

  // Initialize ID mappings from database
  private async initializeIdMappings() {
    try {
      const mappings = await databaseService.getAllIdMappings();
      this.idMappings.clear();
      
      mappings.forEach(mapping => {
        const idMapping: IDMapping = {
          tempId: mapping.tempId,
          actualId: mapping.actualId,
          status: mapping.status as 'pending' | 'completed' | 'failed'
        };
        this.idMappings.set(mapping.tempId, idMapping);
        this.idMappings.set(mapping.actualId, idMapping);
      });
    } catch (error) {
      throw error;
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
  async addPendingChange(actionType: string, entityId: string, data: any) {
    await databaseService.addPendingChange(actionType, entityId, data);
    
    const state = store.getState();
    const isConnected = state.network.isConnected && state.network.isInternetReachable;
    
    if (isConnected) {
      this.processPendingChanges();
    }
  }

  // Sort changes by operation type priority
  private sortChangesByPriority(changes: PendingChange[]): PendingChange[] {
    const createChanges = changes.filter(c => c.actionType === 'CREATE_LIST');
    const updateChanges = changes.filter(c => c.actionType === 'UPDATE_LIST');
    const deleteChanges = changes.filter(c => c.actionType === 'DELETE_LIST');

    return [...createChanges, ...updateChanges, ...deleteChanges];
  }

  // Process all pending changes
  async processPendingChanges() {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      const pendingChanges = await databaseService.getPendingChanges();
      
      // Group changes by entity and sort by operation type
      const changesByEntity = this.groupChangesByEntity(pendingChanges);

      // Process each entity's changes in sequence
      for (const [entityId, changes] of changesByEntity) {
        try {
          await this.processEntityChanges(entityId, changes);
          
          // After successful sync, cleanup any temp lists and mappings
          const mapping = this.idMappings.get(entityId);
          if (mapping && mapping.status === 'completed') {
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

  // Process all changes for a specific entity
  private async processEntityChanges(entityId: string, changes: PendingChange[]) {
    let operationCount = 0;

    try {
      for (const change of changes) {
        await this.processChange(change);
        operationCount++;
      }
    } catch (error) {
      throw error;
    }
  }

  // Process a single change
  private async processChange(change: PendingChange) {
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
        status: 'completed' as const
      };

      await Promise.all([
        (async () => {
          this.idMappings.set(change.entityId, newMapping);
          this.idMappings.set(newList._id, newMapping);
          await databaseService.saveIdMapping(change.entityId, newList._id, 'completed');
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
        databaseService.updatePendingChangeStatus(change.id, 'failed'),
        databaseService.updateIdMappingStatus(change.entityId, 'failed')
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
}

export const syncService = new SyncService();
export default syncService; 