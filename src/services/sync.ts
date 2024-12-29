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

  private sortChangesByPriority(changes: PendingChange[]): PendingChange[] {
    const createChanges = changes.filter(c => c.actionType === 'CREATE_LIST');
    const updateChanges = changes.filter(c => c.actionType === 'UPDATE_LIST');
    const deleteChanges = changes.filter(c => c.actionType === 'DELETE_LIST');

    console.log('[Sync Queue] Sorting changes by priority:', {
      before: changes.map(c => ({ id: c.id, type: c.actionType })),
      after: [...createChanges, ...updateChanges, ...deleteChanges].map(c => ({ id: c.id, type: c.actionType }))
    });

    return [...createChanges, ...updateChanges, ...deleteChanges];
  }

  private async processPendingChanges() {
    if (this.isProcessing) {
      console.log('[Sync Queue] Already processing changes, skipping...');
      return;
    }

    const startTime = Date.now();
    console.log('[Sync Queue] Starting sync process:', { startTime });

    try {
      this.isProcessing = true;
      console.time('fetchPendingChanges');
      const pendingChanges = await databaseService.getPendingChanges();
      console.timeEnd('fetchPendingChanges');
      
      console.log('[Sync Queue] Retrieved pending changes:', {
        duration: Date.now() - startTime,
        totalChanges: pendingChanges.length,
        changes: pendingChanges.map(c => ({
          id: c.id,
          type: c.actionType,
          entityId: c.entityId
        }))
      });

      // Group changes by entity and sort by operation type
      console.time('groupAndSortChanges');
      const changesByEntity = this.groupChangesByEntity(pendingChanges);
      console.timeEnd('groupAndSortChanges');
      
      // Process each entity's changes in sequence
      for (const [entityId, changes] of changesByEntity) {
        const groupStartTime = Date.now();
        console.log('[Sync Queue] Processing entity group:', {
          startTime: groupStartTime,
          entityId,
          totalChanges: changes.length,
          changes: changes.map(c => ({
            id: c.id,
            type: c.actionType
          }))
        });

        try {
          await this.processEntityChanges(entityId, changes);
          console.log('[Sync Queue] Completed entity group:', {
            entityId,
            duration: Date.now() - groupStartTime
          });
        } catch (error) {
          console.error('[Sync Queue] Failed entity group:', {
            entityId,
            duration: Date.now() - groupStartTime,
            error
          });
          await this.markDependentChangesFailed(entityId, changes);
        }
      }

      const endTime = Date.now();
      console.log('[Sync Queue] Sync process completed:', {
        totalDuration: endTime - startTime,
        endTime
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private groupChangesByEntity(changes: PendingChange[]): Map<string, PendingChange[]> {
    const groups = new Map<string, PendingChange[]>();
    
    for (const change of changes) {
      const existing = groups.get(change.entityId) || [];
      groups.set(change.entityId, [...existing, change]);
    }

    // Sort changes within each group by operation type priority
    for (const [entityId, entityChanges] of groups) {
      groups.set(entityId, this.sortChangesByPriority(entityChanges));
    }

    return groups;
  }

  private async processEntityChanges(entityId: string, changes: PendingChange[]) {
    const startTime = Date.now();
    let operationCount = 0;

    try {
      for (const change of changes) {
        const opStartTime = Date.now();
        operationCount++;

        console.log('[Sync Queue] Starting operation:', {
          count: operationCount,
          totalOps: changes.length,
          type: change.actionType,
          startTime: opStartTime
        });

        await this.processChange(change);

        console.log('[Sync Queue] Completed operation:', {
          type: change.actionType,
          duration: Date.now() - opStartTime
        });
      }

      console.log('[Sync Queue] Entity changes completed:', {
        entityId,
        totalOperations: operationCount,
        totalDuration: Date.now() - startTime,
        averageOpTime: (Date.now() - startTime) / operationCount
      });
    } catch (error) {
      console.error('[Sync Queue] Entity changes failed:', {
        entityId,
        completedOps: operationCount,
        totalOps: changes.length,
        duration: Date.now() - startTime,
        error
      });
      throw error;
    }
  }

  private async processChange(change: PendingChange) {
    try {
      const currentMapping = this.idMappings.get(change.entityId);
      console.log(`[Sync Queue] Starting operation:`, {
        type: change.actionType,
        entityId: change.entityId,
        currentMapping,
        allMappings: Array.from(this.idMappings.entries())
      });
      
      switch (change.actionType) {
        case 'CREATE_LIST':
          await this.processCreateList(change);
          break;
        case 'UPDATE_LIST':
        case 'DELETE_LIST':
          // Ensure we have a valid ID mapping
          const mapping = this.idMappings.get(change.entityId);
          if (!mapping || mapping.status !== 'completed') {
            // Try to find mapping by actualId
            const mappingByActualId = Array.from(this.idMappings.values())
              .find(m => m.actualId === change.entityId);
            
            if (mappingByActualId) {
              console.log('[Sync Queue] Found mapping by actual ID:', {
                entityId: change.entityId,
                mapping: mappingByActualId
              });
              // Update the mapping for this entity
              this.idMappings.set(change.entityId, mappingByActualId);
            } else {
              console.warn('[Sync Queue] Cannot process operation - no valid mapping found:', {
                type: change.actionType,
                entityId: change.entityId,
                currentMapping: mapping,
                allMappings: Array.from(this.idMappings.entries())
              });
              throw new Error('Missing required ID mapping');
            }
          }
          
          if (change.actionType === 'UPDATE_LIST') {
            await this.processUpdateList(change);
          } else {
            await this.processDeleteList(change);
          }
          break;
      }
    } catch (error: any) {
      console.error(`[Sync Queue] Operation failed:`, {
        changeId: change.id,
        type: change.actionType,
        entityId: change.entityId,
        error: error.message,
        mappings: Array.from(this.idMappings.entries())
      });
      throw error;
    }
  }

  private async processCreateList(change: PendingChange) {
    const startTime = Date.now();
    try {
      console.log('[Sync Queue] Creating list:', {
        startTime,
        tempId: change.entityId
      });

      const response = await api.post('/lists', change.data);
      const newList = response.data;
      
      // Store ID mapping
      const newMapping = {
        tempId: change.entityId,
        actualId: newList._id,
        status: 'completed' as const
      };

      // Batch our storage operations
      await Promise.all([
        // Update ID mappings
        (async () => {
          this.idMappings.set(change.entityId, newMapping);
          this.idMappings.set(newList._id, newMapping);
        })(),
        // Update store
        store.dispatch(updateListInStore(newList)),
        // Remove pending change
        databaseService.removePendingChange(change.id)
      ]);

      console.log('[Sync Queue] List created:', {
        duration: Date.now() - startTime,
        tempId: change.entityId,
        newId: newList._id
      });

    } catch (error: any) {
      console.error('[Sync Queue] Create failed:', {
        duration: Date.now() - startTime,
        error: error.message
      });
      throw error;
    }
  }

  private getActualId(entityId: string): string {
    const mapping = this.idMappings.get(entityId);
    if (mapping?.status === 'completed') {
      console.log('[Sync Queue] Found ID mapping:', {
        entityId,
        mapping
      });
      return mapping.actualId;
    }
    
    // Try to find by actual ID
    const mappingByActualId = Array.from(this.idMappings.values())
      .find(m => m.actualId === entityId);
    
    if (mappingByActualId) {
      console.log('[Sync Queue] Found reverse ID mapping:', {
        entityId,
        mapping: mappingByActualId
      });
      return mappingByActualId.actualId;
    }
    
    console.log('[Sync Queue] No mapping found:', {
      entityId,
      allMappings: Array.from(this.idMappings.entries())
    });
    return entityId;
  }

  private async processUpdateList(change: PendingChange) {
    const startTime = Date.now();
    try {
      const actualId = this.getActualId(change.entityId);
      
      console.log('[Sync Queue] Updating list:', {
        startTime,
        originalId: change.entityId,
        actualId
      });

      const response = await api.patch(`/lists/${actualId}`, change.data);
      
      // Batch our storage operations
      await Promise.all([
        store.dispatch(updateListInStore(response.data)),
        databaseService.removePendingChange(change.id)
      ]);

      console.log('[Sync Queue] List updated:', {
        duration: Date.now() - startTime,
        actualId
      });
    } catch (error: any) {
      console.error('[Sync Queue] Update failed:', {
        duration: Date.now() - startTime,
        error: error.message
      });
      throw error;
    }
  }

  private async processDeleteList(change: PendingChange) {
    const startTime = Date.now();
    try {
      const actualId = this.getActualId(change.entityId);
      
      console.log('[Sync Queue] Deleting list:', {
        startTime,
        originalId: change.entityId,
        actualId
      });

      await Promise.all([
        api.delete(`/lists/${actualId}`),
        databaseService.removePendingChange(change.id)
      ]);

      console.log('[Sync Queue] List deleted:', {
        duration: Date.now() - startTime,
        actualId
      });
    } catch (error: any) {
      console.error('[Sync Queue] Delete failed:', {
        duration: Date.now() - startTime,
        error: error.message
      });
      throw error;
    }
  }

  private async markDependentChangesFailed(entityId: string, changes: PendingChange[]) {
    console.log('[Sync Queue] Marking dependent changes as failed:', {
      entityId,
      changes: changes.map(c => ({
        id: c.id,
        type: c.actionType
      }))
    });

    for (const change of changes) {
      await databaseService.updatePendingChangeStatus(change.id, 'failed');
    }
  }
}

export const syncService = new SyncService();
export default syncService; 