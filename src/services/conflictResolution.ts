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
      // Merge local and server changes, preferring server version for conflict resolution
      const mergedList: List = {
        ...serverList,
        items: await this.mergeItems(localList.items || [], serverList.items || []),
        __v: serverList.__v,
        updatedAt: new Date().toISOString()
      };

      this.validateMergedList(mergedList);
      return mergedList;
    } catch (error: any) {
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
    
    // Start with server items as the base
    serverItems.forEach(item => {
      itemMap.set(item._id, { ...item });
    });

    // Merge local changes, keeping newer updates
    localItems.forEach(item => {
      const existing = itemMap.get(item._id);
      if (existing) {
        if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
          itemMap.set(item._id, { ...item });
        }
      } else {
        itemMap.set(item._id, { ...item });
      }
    });

    return Array.from(itemMap.values());
  }
}

class DeleteConflictStrategy implements ConflictResolutionStrategy {
  async resolveConflict(localList: List, serverList: List): Promise<List> {
    try {
      // Keep local changes if they're newer than server deletion
      if (!serverList && localList.__v > 1) {
        return localList;
      }
      // Accept server state if it has a newer version
      if (serverList && serverList.__v > (localList.__v || 0)) {
        return serverList;
      }
      return localList;
    } catch (error: any) {
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
    const strategy = this.strategies.get(conflictType);
    if (!strategy) {
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
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
        return this.resolveListConflict(localList, serverList, conflictType, retryCount + 1);
      }

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
      if (this.pendingHistory.length >= this.HISTORY_BATCH_SIZE) {
        await this.persistConflictHistory();
      }
    } catch (error: any) {
      // Non-critical error, don't interrupt the main flow
    }
  }

  private async persistConflictHistory(retryCount: number = 0): Promise<void> {
    if (this.pendingHistory.length === 0) return;

    try {
      await databaseService.batchSaveConflictHistory(this.pendingHistory);
      this.pendingHistory = [];
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
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
      return this.pendingHistory.slice(0, limit);
    }
  }

  async clearConflictHistory() {
    this.pendingHistory = [];
    try {
      await databaseService.clearConflictHistory();
    } catch (error) {
      throw new Error('Failed to clear conflict history');
    }
  }

  async cleanupOldHistory(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    try {
      await databaseService.deleteConflictHistoryBefore(cutoffDate.getTime());
    } catch (error) {
      throw new Error('Failed to cleanup old history');
    }
  }
}

export const conflictResolutionService = ConflictResolutionService.getInstance();
export default conflictResolutionService; 