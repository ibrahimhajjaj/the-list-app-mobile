import * as SQLite from 'expo-sqlite';
import { Settings } from '../types/settings';
import { ConflictDetails } from './conflictResolution';
import { ACTION_TYPES } from '../types/list';

const db = SQLite.openDatabaseSync('thelistapp.db');

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

class DatabaseService {
  private transactionInProgress: boolean = false;
  private transactionQueue: Array<() => Promise<void>> = [];

  constructor() {
    this.initDatabase();
  }

  private async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.transactionInProgress) {
      // Queue the operation if a transaction is in progress
      return new Promise((resolve, reject) => {
        this.transactionQueue.push(async () => {
          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    this.transactionInProgress = true;
    try {
      const result = await operation();
      
      // Process queued operations
      while (this.transactionQueue.length > 0) {
        const nextOperation = this.transactionQueue.shift();
        if (nextOperation) {
          await nextOperation();
        }
      }
      
      return result;
    } finally {
      this.transactionInProgress = false;
    }
  }

  private initDatabase() {
    // Create tables if they don't exist
    db.execSync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT,
        user_data TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        data TEXT,
        last_updated INTEGER,
        is_shared INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        server_version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS selected_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id TEXT
      );

      CREATE TABLE IF NOT EXISTS pending_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        retries INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        base_version INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS id_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temp_id TEXT NOT NULL,
        actual_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conflict_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        local_data TEXT NOT NULL,
        server_data TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        resolution TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      -- Create indices for frequently queried columns
      CREATE INDEX IF NOT EXISTS idx_lists_is_shared ON lists(is_shared);
      CREATE INDEX IF NOT EXISTS idx_lists_last_updated ON lists(last_updated);
      CREATE INDEX IF NOT EXISTS idx_lists_version ON lists(version);
      CREATE INDEX IF NOT EXISTS idx_lists_server_version ON lists(server_version);
      CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_changes(status);
      CREATE INDEX IF NOT EXISTS idx_pending_changes_entity_id ON pending_changes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_id_mappings_temp_id ON id_mappings(temp_id);
      CREATE INDEX IF NOT EXISTS idx_id_mappings_actual_id ON id_mappings(actual_id);
      CREATE INDEX IF NOT EXISTS idx_id_mappings_status ON id_mappings(status);
      CREATE INDEX IF NOT EXISTS idx_conflict_history_timestamp ON conflict_history(timestamp);
      CREATE INDEX IF NOT EXISTS idx_conflict_history_type ON conflict_history(type);
    `);

    // Initialize default settings if not exists
    db.runAsync(`
      INSERT OR IGNORE INTO settings (key, value) VALUES 
        ('theme', 'light'),
        ('notificationsEnabled', 'true'),
        ('titleChangeNotifications', 'true'),
        ('itemAddNotifications', 'true'),
        ('itemDeleteNotifications', 'true'),
        ('itemEditNotifications', 'true'),
        ('itemCompleteNotifications', 'true')
    `);
  }

  // Auth operations
  async saveAuthData(token: string | null, userData: any | null): Promise<void> {
    await db.execAsync('DELETE FROM auth');
    if (token || userData) {
      await db.runAsync(
        'INSERT INTO auth (token, user_data) VALUES (?, ?)',
        [token, userData ? JSON.stringify(userData) : null]
      );
    }
  }

  async getAuthData(): Promise<{ token: string | null; userData: any | null }> {
    const result = await db.getFirstAsync<{ token: string | null; user_data: string | null }>(
      'SELECT token, user_data FROM auth LIMIT 1'
    );
    const authData = {
      token: result?.token || null,
      userData: result?.user_data ? JSON.parse(result.user_data) : null
    };
    return authData;
  }

  // Settings operations
  async saveSettings(settings: Partial<Settings>): Promise<void> {
    await db.withTransactionAsync(async () => {
      // Update only the provided settings
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        await db.runAsync(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, String(value)]
        );
      }
    });
  }

  async getSettings(): Promise<Settings | null> {
    const results = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM settings'
    );

    if (results.length === 0) return null;

    const settings = {
      theme: 'light' as 'light' | 'dark',
      notificationsEnabled: true,
      titleChangeNotifications: true,
      itemAddNotifications: true,
      itemDeleteNotifications: true,
      itemEditNotifications: true,
      itemCompleteNotifications: true
    };

    for (const row of results) {
      if (row.key === 'theme') {
        settings[row.key] = row.value as 'light' | 'dark';
      } else {
        settings[row.key as keyof Omit<Settings, 'theme'>] = row.value === 'true';
      }
    }

    return settings;
  }

  // Lists operations
  async saveLists(lists: any[], isShared: boolean = false): Promise<void> {
    await this.executeInTransaction(async () => {
      await db.withTransactionAsync(async () => {
        for (const list of lists) {
          const currentList = await db.getFirstAsync<{ version: number, server_version: number }>(
            'SELECT version, server_version FROM lists WHERE id = ?',
            [list._id]
          );

          const version = currentList ? currentList.version + 1 : 1;
          const serverVersion = list.version || (currentList ? currentList.server_version : 1);

          await db.runAsync(
            'INSERT OR REPLACE INTO lists (id, data, last_updated, is_shared, version, server_version) VALUES (?, ?, ?, ?, ?, ?)',
            [list._id, JSON.stringify(list), Date.now(), isShared ? 1 : 0, version, serverVersion]
          );
        }
      });
    });
  }

  async getLists(isShared: boolean = false): Promise<any[]> {
    const results = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM lists WHERE is_shared = ? ORDER BY last_updated DESC',
      [isShared ? 1 : 0]
    );

    const lists = results.map(row => JSON.parse(row.data));
    return lists;
  }

  // Shared lists operations
  async saveSharedLists(lists: any[]): Promise<void> {
    return this.saveLists(lists, true);
  }

  async getSharedLists(): Promise<any[]> {
    return this.getLists(true);
  }

  // Selected list operations
  async saveSelectedList(listId: string | null): Promise<void> {
    await db.execAsync('DELETE FROM selected_list');
    if (listId) {
      await db.runAsync(
        'INSERT INTO selected_list (list_id) VALUES (?)',
        [listId]
      );
    }
  }

  async getSelectedList(): Promise<string | null> {
    const result = await db.getFirstAsync<{ list_id: string }>(
      'SELECT list_id FROM selected_list LIMIT 1'
    );
    return result ? result.list_id : null;
  }

  // Pending changes operations
  async updatePendingChange(id: number, change: any): Promise<void> {
    await db.runAsync(
      'UPDATE pending_changes SET data = ? WHERE id = ?',
      [JSON.stringify(change.data), id]
    );
  }

  async addPendingChange(actionType: SyncActionType, entityId: string, data: any): Promise<void> {
    const currentList = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM lists WHERE id = ?',
      [entityId]
    );

    await db.runAsync(
      'INSERT INTO pending_changes (action_type, entity_id, data, timestamp, base_version) VALUES (?, ?, ?, ?, ?)',
      [actionType, entityId, JSON.stringify(data), Date.now(), currentList?.version || 1]
    );
  }

  async getPendingChanges(): Promise<Array<{
    id: number;
    actionType: string;
    entityId: string;
    data: any;
    timestamp: number;
    retries: number;
    status: string;
  }>> {
    interface PendingChangeRow {
      id: number;
      action_type: string;
      entity_id: string;
      data: string;
      timestamp: number;
      retries: number;
      status: string;
      base_version: number;
    }

    const results = await db.getAllAsync<PendingChangeRow>(
      'SELECT * FROM pending_changes WHERE status = ? ORDER BY timestamp ASC',
      ['pending']
    );

    return results.map(row => ({
      id: row.id,
      actionType: row.action_type,
      entityId: row.entity_id,
      data: JSON.parse(row.data),
      timestamp: row.timestamp,
      retries: row.retries,
      status: row.status
    }));
  }

  async updatePendingChangeStatus(id: number, status: string, retries?: number): Promise<void> {
    if (retries !== undefined) {
      await db.runAsync(
        'UPDATE pending_changes SET status = ?, retries = ? WHERE id = ?',
        [status, retries, id]
      );
    } else {
      await db.runAsync(
        'UPDATE pending_changes SET status = ? WHERE id = ?',
        [status, id]
      );
    }
  }

  async removePendingChange(id: number): Promise<void> {
    await db.runAsync('DELETE FROM pending_changes WHERE id = ?', [id]);
  }

  async clearAllData(): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM auth;
        DELETE FROM settings;
        DELETE FROM lists;
        DELETE FROM selected_list;
        DELETE FROM pending_changes;
        DELETE FROM id_mappings;
        DELETE FROM conflict_history;
      `);
    });
  }

  async updatePendingChangeEntityId(changeId: number, newEntityId: string) {
    await db.runAsync(
      `UPDATE pending_changes 
       SET entity_id = ? 
       WHERE id = ?`,
      [newEntityId, changeId]
    );
  }

  async incrementChangeRetry(changeId: number): Promise<void> {
    await db.runAsync(
      `UPDATE pending_changes 
       SET retries = retries + 1 
       WHERE id = ?`,
      [changeId]
    );
  }

  // Conflict history methods
  async batchSaveConflictHistory(conflicts: ConflictDetails[]): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const conflict of conflicts) {
        await db.runAsync(
          `INSERT INTO conflict_history 
           (type, local_data, server_data, timestamp, resolution, metadata, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            conflict.type,
            JSON.stringify(conflict.localData),
            JSON.stringify(conflict.serverData),
            conflict.timestamp,
            conflict.resolution || null,
            conflict.metadata ? JSON.stringify(conflict.metadata) : null,
            Date.now()
          ]
        );
      }
    });
  }

  async getConflictHistory(limit: number = 100): Promise<ConflictDetails[]> {
    const results = await db.getAllAsync<{
      type: string;
      local_data: string;
      server_data: string;
      timestamp: number;
      resolution: string | null;
      metadata: string | null;
    }>(
      `SELECT type, local_data, server_data, timestamp, resolution, metadata 
       FROM conflict_history 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [limit]
    );

    return results.map(row => ({
      type: row.type,
      localData: JSON.parse(row.local_data),
      serverData: JSON.parse(row.server_data),
      timestamp: row.timestamp,
      resolution: row.resolution || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  async clearConflictHistory(): Promise<void> {
    await db.runAsync('DELETE FROM conflict_history');
  }

  async deleteConflictHistoryBefore(timestamp: number): Promise<void> {
    await db.runAsync(
      'DELETE FROM conflict_history WHERE timestamp < ?',
      [timestamp]
    );
  }

  // ID Mapping operations
  async saveIdMapping(tempId: string, actualId: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT OR REPLACE INTO id_mappings 
       (temp_id, actual_id, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [tempId, actualId, status, now, now]
    );
  }

  async getIdMapping(id: string): Promise<{ tempId: string; actualId: string; status: string } | null> {
    const mapping = await db.getFirstAsync<{ temp_id: string; actual_id: string; status: string }>(
      'SELECT temp_id, actual_id, status FROM id_mappings WHERE temp_id = ? OR actual_id = ?',
      [id, id]
    );

    return mapping ? {
      tempId: mapping.temp_id,
      actualId: mapping.actual_id,
      status: mapping.status
    } : null;
  }

  async getAllIdMappings(): Promise<Array<{ tempId: string; actualId: string; status: string }>> {
    const mappings = await db.getAllAsync<{ temp_id: string; actual_id: string; status: string }>(
      'SELECT temp_id, actual_id, status FROM id_mappings'
    );

    return mappings.map(m => ({
      tempId: m.temp_id,
      actualId: m.actual_id,
      status: m.status
    }));
  }

  async updateIdMappingStatus(id: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    await db.runAsync(
      `UPDATE id_mappings 
       SET status = ?, updated_at = ? 
       WHERE temp_id = ? OR actual_id = ?`,
      [status, Date.now(), id, id]
    );
  }

  async removeIdMapping(tempId: string): Promise<void> {
    await db.runAsync(
      'DELETE FROM id_mappings WHERE temp_id = ?',
      [tempId]
    );
  }
}

export const databaseService = new DatabaseService();
export default databaseService; 