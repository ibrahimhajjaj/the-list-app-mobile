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
    // Initialize ID mappings from database
    this.initializeIdMappings();
  }

  private async initializeIdMappings() {
    console.log('[Sync Debug] Initializing ID mappings from database');
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

      console.log('[Sync Debug] ID mappings initialized:', {
        totalMappings: mappings.length,
        mappings: Array.from(this.idMappings.entries()).map(([id, m]) => ({
          id: id.substring(0, 8),
          tempId: m.tempId.substring(0, 8),
          actualId: m.actualId.substring(0, 8),
          status: m.status
        }))
      });
    } catch (error) {
      console.error('[Sync Debug] Error initializing ID mappings:', error);
    }
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
    console.log('[Sync] Adding pending change:', {
      type: actionType,
      entityId: entityId.substring(0, 8),
      dataKeys: Object.keys(data)
    });

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
      console.log('[Sync] Already processing changes, skipping...');
      return;
    }

    const startTime = Date.now();
    console.log('[Sync] Starting sync process:', { 
      startTime,
      mappings: Array.from(this.idMappings.entries()).map(([id, mapping]) => ({
        id: id.substring(0, 8),
        tempId: mapping.tempId.substring(0, 8),
        actualId: mapping.actualId.substring(0, 8),
        status: mapping.status
      }))
    });

    try {
      this.isProcessing = true;
      const pendingChanges = await databaseService.getPendingChanges();
      
      console.log('[Sync] Retrieved pending changes:', {
        duration: Date.now() - startTime,
        totalChanges: pendingChanges.length,
        changes: pendingChanges.map(c => ({
          id: c.id,
          type: c.actionType,
          entityId: c.entityId.substring(0, 8)
        }))
      });

      // Group changes by entity and sort by operation type
      const changesByEntity = this.groupChangesByEntity(pendingChanges);
      
      // Process each entity's changes in sequence
      for (const [entityId, changes] of changesByEntity) {
        const groupStartTime = Date.now();
        console.log('[Sync] Processing entity group:', {
          entityId: entityId.substring(0, 8),
          totalChanges: changes.length,
          changes: changes.map(c => ({
            id: c.id,
            type: c.actionType
          }))
        });

        try {
          await this.processEntityChanges(entityId, changes);
          
          // After successful sync, cleanup any temp lists and mappings
          const mapping = this.idMappings.get(entityId);
          if (mapping && mapping.status === 'completed') {
            console.log('[Sync] Running cleanup after successful sync:', {
              entityId: entityId.substring(0, 8),
              mapping: {
                tempId: mapping.tempId.substring(0, 8),
                actualId: mapping.actualId.substring(0, 8)
              }
            });
            await this.cleanupAfterSync(mapping.tempId, mapping.actualId);
          }

          console.log('[Sync] Completed entity group:', {
            entityId: entityId.substring(0, 8),
            duration: Date.now() - groupStartTime
          });
        } catch (error) {
          console.error('[Sync] Failed entity group:', {
            entityId: entityId.substring(0, 8),
            duration: Date.now() - groupStartTime,
            error: error instanceof Error ? error.message : String(error)
          });
          await this.markDependentChangesFailed(entityId, changes);
        }
      }

      const endTime = Date.now();
      console.log('[Sync] Sync process completed:', {
        totalDuration: endTime - startTime,
        endTime,
        finalMappings: Array.from(this.idMappings.entries()).map(([id, mapping]) => ({
          id: id.substring(0, 8),
          tempId: mapping.tempId.substring(0, 8),
          actualId: mapping.actualId.substring(0, 8),
          status: mapping.status
        }))
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
    const tempIdPattern = /^temp_\d+_[a-z0-9]+$/;

    // Add detailed mapping state logging
    console.log('[Sync Debug] Starting entity changes:', {
      entityId: entityId.substring(0, 8),
      totalChanges: changes.length,
      currentMappings: Array.from(this.idMappings.entries()).map(([id, m]) => ({
        id: id.substring(0, 8),
        tempId: m.tempId.substring(0, 8),
        actualId: m.actualId.substring(0, 8),
        status: m.status
      }))
    });

    try {
      for (const change of changes) {
        const opStartTime = Date.now();
        operationCount++;

        // Enhanced temp ID logging
        if (tempIdPattern.test(change.entityId)) {
          console.log('[Sync Debug] Processing temp ID:', {
            tempId: change.entityId.substring(0, 8),
            operation: change.actionType,
            existingMappings: Array.from(this.idMappings.entries())
              .filter(([_, m]) => m.tempId === change.entityId)
              .map(([id, m]) => ({
                id: id.substring(0, 8),
                status: m.status,
                actualId: m.actualId.substring(0, 8)
              }))
          });
        }

        // Add pre-operation mapping check
        console.log('[Sync Debug] Pre-operation mapping state:', {
          entityId: change.entityId.substring(0, 8),
          operation: change.actionType,
          hasMapping: this.idMappings.has(change.entityId),
          mappingDetails: this.idMappings.get(change.entityId)
        });

        await this.processChange(change);

        // Add post-operation mapping check
        console.log('[Sync Debug] Post-operation mapping state:', {
          entityId: change.entityId.substring(0, 8),
          operation: change.actionType,
          hasMapping: this.idMappings.has(change.entityId),
          mappingDetails: this.idMappings.get(change.entityId),
          duration: Date.now() - opStartTime
        });
      }

      // Add final mapping state for this entity
      console.log('[Sync Debug] Completed entity changes:', {
        entityId: entityId.substring(0, 8),
        totalOps: operationCount,
        duration: Date.now() - startTime,
        finalMappings: Array.from(this.idMappings.entries())
          .filter(([id, _]) => id === entityId || this.idMappings.get(id)?.tempId === entityId)
          .map(([id, m]) => ({
            id: id.substring(0, 8),
            tempId: m.tempId.substring(0, 8),
            actualId: m.actualId.substring(0, 8),
            status: m.status
          }))
      });

    } catch (error) {
      console.error('[Sync Debug] Entity changes failed:', {
        entityId: entityId.substring(0, 8),
        error: error instanceof Error ? error.message : String(error),
        completedOps: operationCount,
        duration: Date.now() - startTime,
        failedMappings: Array.from(this.idMappings.entries())
          .filter(([id, _]) => id === entityId || this.idMappings.get(id)?.tempId === entityId)
          .map(([id, m]) => ({
            id: id.substring(0, 8),
            tempId: m.tempId.substring(0, 8),
            actualId: m.actualId.substring(0, 8),
            status: m.status
          }))
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
            // Try to find mapping in database
            const dbMapping = await databaseService.getIdMapping(change.entityId);
            
            if (dbMapping && dbMapping.status === 'completed') {
              console.log('[Sync Queue] Found mapping in database:', {
                entityId: change.entityId,
                mapping: dbMapping
              });
              // Update memory mapping
              const newMapping: IDMapping = {
                tempId: dbMapping.tempId,
                actualId: dbMapping.actualId,
                status: dbMapping.status as 'pending' | 'completed' | 'failed'
              };
              this.idMappings.set(change.entityId, newMapping);
            } else {
              console.warn('[Sync Queue] Cannot process operation - no valid mapping found:', {
                type: change.actionType,
                entityId: change.entityId,
                currentMapping: mapping,
                dbMapping,
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

  private async cleanupAfterSync(tempId: string, actualId: string) {
    console.log('[Sync Cleanup] Starting cleanup:', {
      tempId: tempId.substring(0, 8),
      actualId: actualId.substring(0, 8)
    });

    try {
      // Get current lists from storage
      const storedLists = await storage.getLists();
      
      // Log state before cleanup
      console.log('[Sync Cleanup] Before cleanup:', {
        tempId,
        actualId,
        totalLists: storedLists.length,
        tempLists: storedLists.filter((l: List) => l.isTemp).length,
        lists: storedLists.map((l: List) => ({
          id: l._id.substring(0, 8),
          title: l.title,
          isTemp: l.isTemp
        }))
      });
      
      // Remove the temporary list while keeping the actual one
      const updatedLists = storedLists.filter((list: List) => 
        list._id !== tempId || list._id === actualId
      );

      // Save the filtered lists back to storage
      await storage.saveLists(updatedLists);

      // Remove the ID mapping since we don't need it anymore
      await databaseService.removeIdMapping(tempId);

      // Log state after cleanup
      console.log('[Sync Cleanup] After cleanup:', {
        tempId,
        actualId,
        totalLists: updatedLists.length,
        tempLists: updatedLists.filter((l: List) => l.isTemp).length,
        lists: updatedLists.map((l: List) => ({
          id: l._id.substring(0, 8),
          title: l.title,
          isTemp: l.isTemp
        })),
        removedMapping: true
      });

      console.log('[Sync Cleanup] Completed:', {
        tempId: tempId.substring(0, 8),
        actualId: actualId.substring(0, 8),
        removedMapping: true,
        listsRemoved: storedLists.length - updatedLists.length
      });
    } catch (error) {
      console.error('[Sync Cleanup] Failed:', {
        tempId: tempId.substring(0, 8),
        actualId: actualId.substring(0, 8),
        error: error instanceof Error ? error.message : String(error)
      });
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
        // Update ID mappings in memory and database
        (async () => {
          this.idMappings.set(change.entityId, newMapping);
          this.idMappings.set(newList._id, newMapping);
          await databaseService.saveIdMapping(change.entityId, newList._id, 'completed');
        })(),
        // Update store
        store.dispatch(updateListInStore(newList)),
        // Remove pending change
        databaseService.removePendingChange(change.id)
      ]);

      // Clean up the temporary list and mapping
      await this.cleanupAfterSync(change.entityId, newList._id);

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
    // Add detailed ID resolution logging
    console.log('[Sync Debug] Resolving actual ID:', {
      entityId: entityId.substring(0, 8),
      isTemp: entityId.startsWith('temp_'),
      mappingCount: this.idMappings.size
    });

    // First try direct mapping from memory
    const mapping = this.idMappings.get(entityId);
    if (mapping?.status === 'completed') {
      console.log('[Sync Debug] Found direct mapping in memory:', {
        entityId: entityId.substring(0, 8),
        actualId: mapping.actualId.substring(0, 8),
        status: mapping.status
      });
      return mapping.actualId;
    }

    // Try to find by actual ID in memory
    const mappingByActualId = Array.from(this.idMappings.values())
      .find(m => m.actualId === entityId);

    if (mappingByActualId) {
      console.log('[Sync Debug] Found reverse mapping in memory:', {
        entityId: entityId.substring(0, 8),
        actualId: mappingByActualId.actualId.substring(0, 8),
        status: mappingByActualId.status
      });
      return mappingByActualId.actualId;
    }

    // If not found in memory, try database
    databaseService.getIdMapping(entityId).then(dbMapping => {
      if (dbMapping) {
        console.log('[Sync Debug] Found mapping in database:', {
          entityId: entityId.substring(0, 8),
          mapping: {
            tempId: dbMapping.tempId.substring(0, 8),
            actualId: dbMapping.actualId.substring(0, 8),
            status: dbMapping.status
          }
        });
        // Update memory mapping for future use
        const newMapping: IDMapping = {
          tempId: dbMapping.tempId,
          actualId: dbMapping.actualId,
          status: dbMapping.status as 'pending' | 'completed' | 'failed'
        };
        this.idMappings.set(dbMapping.tempId, newMapping);
        this.idMappings.set(dbMapping.actualId, newMapping);
        return dbMapping.actualId;
      }
    });

    // Log mapping failure details
    console.log('[Sync Debug] No mapping found:', {
      entityId: entityId.substring(0, 8),
      allMappings: Array.from(this.idMappings.entries()).map(([id, m]) => ({
        id: id.substring(0, 8),
        tempId: m.tempId.substring(0, 8),
        actualId: m.actualId.substring(0, 8),
        status: m.status
      }))
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

      try {
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
        // Handle conflict (409) responses
        if (error.response?.status === 409) {
          console.log('[Sync Queue] Handling conflict:', {
            entityId: change.entityId,
            serverData: error.response.data.serverData,
            serverVersion: error.response.data.serverData.__v,
            conflictType: error.response.data.conflictType
          });

          // Get the server's version
          const serverList = error.response.data.serverData;

          // Merge changes
          const mergedData = await this.handleConflict(change.entityId, serverList, error.response.data.conflictType);

          console.log('[Sync Queue] Merged data:', {
            entityId: change.entityId,
            mergedFields: Object.keys(mergedData),
            originalChanges: Object.keys(serverList),
            serverVersion: serverList.__v
          });

          // Retry with merged data
          const retryResponse = await api.patch(`/lists/${actualId}`, mergedData);
          
          // Update storage with merged result
          await Promise.all([
            store.dispatch(updateListInStore(retryResponse.data)),
            databaseService.removePendingChange(change.id)
          ]);

          console.log('[Sync Queue] Conflict resolved:', {
            entityId: change.entityId,
            duration: Date.now() - startTime,
            finalVersion: retryResponse.data.version
          });
        } else {
          // Re-throw non-conflict errors
          throw error;
        }
      }
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
      await Promise.all([
        databaseService.updatePendingChangeStatus(change.id, 'failed'),
        databaseService.updateIdMappingStatus(change.entityId, 'failed')
      ]);
    }
  }

  async handleConflict(entityId: string, serverData: any, conflictType: string) {
    console.log('[Sync Queue] Handling conflict:', {
      entityId,
      conflictType,
      serverData
    });

    // Get local list data
    const lists = await storage.getLists();
    const localList = lists.find(list => list._id === entityId);

    if (!localList) {
      console.warn('[Sync Queue] No local list found for conflict resolution:', entityId);
      return serverData;
    }

    try {
      // Use conflict resolution service
      const resolvedList = await conflictResolutionService.resolveListConflict(
        localList,
        serverData,
        conflictType
      );

      console.log('[Sync Queue] Conflict resolved:', {
        entityId,
        resolvedVersion: resolvedList.__v
      });

      return resolvedList;
    } catch (error) {
      console.error('[Sync Queue] Conflict resolution failed:', error);
      // Fallback to server data on error
      return serverData;
    }
  }
}

export const syncService = new SyncService();
export default syncService; 