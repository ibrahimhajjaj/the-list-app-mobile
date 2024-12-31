import { List, ListItem } from '../types/list';
import { databaseService } from './database';

export interface ConflictResolutionStrategy {
  resolveConflict(localData: List, serverData: List): Promise<List>;
}

export interface ConflictDetails {
  type: string;
  localData: any;
  serverData: any;
  timestamp: number;
  resolution?: string;
  metadata?: Record<string, any>;
  retryCount?: number;
  error?: string;
}

class RetryableError extends Error {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(message);
    this.name = 'RetryableError';
  }
}

class UpdateConflictStrategy implements ConflictResolutionStrategy {
  async resolveConflict(localList: List, serverList: List): Promise<List> {
    try {
      console.log('[Conflict Resolution] Resolving update conflict:', {
        localVersion: localList.__v,
        serverVersion: serverList.__v,
        localItems: localList.items.length,
        serverItems: serverList.items.length
      });

      const mergedList: List = {
        ...serverList,
        items: await this.mergeItems(localList.items || [], serverList.items || []),
        __v: serverList.__v,
        updatedAt: new Date().toISOString()
      };

      // Validate merged list
      this.validateMergedList(mergedList);

      console.log('[Conflict Resolution] Resolved to:', {
        version: mergedList.__v,
        items: mergedList.items.length,
        title: mergedList.title
      });

      return mergedList;
    } catch (error: any) {
      console.error('[Conflict Resolution] Update strategy failed:', error);
      throw new RetryableError(`Failed to merge lists: ${error.message}`);
    }
  }

  private validateMergedList(list: List) {
    if (!list._id) throw new Error('Merged list missing ID');
    if (!Array.isArray(list.items)) throw new Error('Invalid items array');
    if (typeof list.__v !== 'number') throw new Error('Invalid version number');
  }

  private async mergeItems(localItems: ListItem[], serverItems: ListItem[]): Promise<ListItem[]> {
    const itemMap = new Map<string, ListItem>();
    const conflicts: Array<{ local: ListItem; server: ListItem }> = [];
    
    // Index server items first (they're the base)
    serverItems.forEach(item => {
      itemMap.set(item._id, { ...item });
    });

    // Merge in local items, detecting conflicts
    localItems.forEach(item => {
      const existing = itemMap.get(item._id);
      if (existing) {
        if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
          itemMap.set(item._id, { ...item });
        } else if (item.text !== existing.text || item.completed !== existing.completed) {
          conflicts.push({ local: item, server: existing });
        }
      } else {
        itemMap.set(item._id, { ...item });
      }
    });

    // Log conflicts if any
    if (conflicts.length > 0) {
      console.warn('[Conflict Resolution] Item conflicts detected:', {
        count: conflicts.length,
        details: conflicts.map(c => ({
          itemId: c.local._id,
          local: { text: c.local.text, completed: c.local.completed },
          server: { text: c.server.text, completed: c.server.completed }
        }))
      });
    }

    return Array.from(itemMap.values());
  }
}

class DeleteConflictStrategy implements ConflictResolutionStrategy {
  async resolveConflict(localList: List, serverList: List): Promise<List> {
    try {
      // If server deleted but local has changes, keep local
      if (!serverList && localList.__v > 1) {
        return localList;
      }
      // If server has newer version, accept server state
      if (serverList && serverList.__v > (localList.__v || 0)) {
        return serverList;
      }
      // Default to local changes
      return localList;
    } catch (error: any) {
      console.error('[Conflict Resolution] Delete strategy failed:', error);
      throw new RetryableError(`Failed to resolve delete conflict: ${error.message}`);
    }
  }
}

export class ConflictResolutionService {
  private static instance: ConflictResolutionService;
  private strategies: Map<string, ConflictResolutionStrategy>;
  private readonly HISTORY_BATCH_SIZE = 50;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private pendingHistory: ConflictDetails[] = [];

  private constructor() {
    this.strategies = new Map();
    this.registerDefaultStrategies();
  }

  static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  private registerDefaultStrategies() {
    this.strategies.set('UPDATE', new UpdateConflictStrategy());
    this.strategies.set('DELETE', new DeleteConflictStrategy());
  }

  registerStrategy(type: string, strategy: ConflictResolutionStrategy) {
    this.strategies.set(type, strategy);
  }

  removeStrategy(type: string) {
    this.strategies.delete(type);
  }

  async resolveListConflict(localList: List, serverList: List, conflictType: string, retryCount: number = 0): Promise<List> {
    console.log('[Conflict Resolution] Starting resolution:', {
      type: conflictType,
      localId: localList._id,
      serverId: serverList._id,
      localVersion: localList.__v,
      serverVersion: serverList.__v,
      retryCount
    });

    const strategy = this.strategies.get(conflictType);
    if (!strategy) {
      console.warn('[Conflict Resolution] No strategy found for type:', conflictType);
      return serverList;
    }

    try {
      const resolvedList = await strategy.resolveConflict(localList, serverList);
      await this.recordConflict({
        type: conflictType,
        localData: localList,
        serverData: serverList,
        timestamp: Date.now(),
        resolution: 'auto',
        retryCount,
        metadata: {
          resolvedVersion: resolvedList.__v,
          strategy: conflictType
        }
      });

      return resolvedList;
    } catch (error) {
      if (error instanceof RetryableError && error.retryable && retryCount < this.MAX_RETRIES) {
        console.log('[Conflict Resolution] Retrying resolution:', {
          type: conflictType,
          retryCount: retryCount + 1,
          error: error.message
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.resolveListConflict(localList, serverList, conflictType, retryCount + 1);
      }

      // Record failed resolution
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.recordConflict({
        type: conflictType,
        localData: localList,
        serverData: serverList,
        timestamp: Date.now(),
        resolution: 'failed',
        retryCount,
        error: errorMessage,
        metadata: {
          error: errorMessage,
          strategy: conflictType
        }
      });

      throw error;
    }
  }

  private async recordConflict(details: ConflictDetails) {
    this.pendingHistory.push(details);
    
    try {
      // When we reach batch size, persist to database
      if (this.pendingHistory.length >= this.HISTORY_BATCH_SIZE) {
        await this.persistConflictHistory();
      }
    } catch (error: any) {
      console.error('[Conflict Resolution] Failed to record conflict:', error);
      // Don't throw here to avoid interrupting the main flow
    }
  }

  private async persistConflictHistory(retryCount: number = 0): Promise<void> {
    if (this.pendingHistory.length === 0) return;

    try {
      await databaseService.batchSaveConflictHistory(this.pendingHistory);
      this.pendingHistory = [];
      console.log('[Conflict Resolution] Persisted conflict history batch');
    } catch (error) {
      console.error('[Conflict Resolution] Failed to persist conflict history:', error);
      
      if (retryCount < this.MAX_RETRIES) {
        console.log('[Conflict Resolution] Retrying persist operation...');
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        await this.persistConflictHistory(retryCount + 1);
      }
    }
  }

  async getConflictHistory(limit: number = 100): Promise<ConflictDetails[]> {
    try {
      const storedHistory = await databaseService.getConflictHistory(limit);
      return [...this.pendingHistory, ...storedHistory].slice(0, limit);
    } catch (error) {
      console.error('[Conflict Resolution] Failed to get conflict history:', error);
      return this.pendingHistory.slice(0, limit);
    }
  }

  async clearConflictHistory() {
    this.pendingHistory = [];
    try {
      await databaseService.clearConflictHistory();
    } catch (error) {
      console.error('[Conflict Resolution] Failed to clear conflict history:', error);
      throw new Error('Failed to clear conflict history');
    }
  }

  async cleanupOldHistory(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      await databaseService.deleteConflictHistoryBefore(cutoffDate.getTime());
      console.log('[Conflict Resolution] Cleaned up conflict history older than:', cutoffDate);
    } catch (error) {
      console.error('[Conflict Resolution] Failed to cleanup old history:', error);
      throw new Error('Failed to cleanup old history');
    }
  }
}

export const conflictResolutionService = ConflictResolutionService.getInstance();
export default conflictResolutionService; 