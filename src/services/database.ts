import * as SQLite from 'expo-sqlite';
import { Settings } from '../types/settings';

const db = SQLite.openDatabaseSync('thelistapp.db');

class DatabaseService {
  constructor() {
    this.initDatabase();
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
        key TEXT UNIQUE NOT NULL,
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

      -- Create indices for frequently queried columns
      CREATE INDEX IF NOT EXISTS idx_lists_is_shared ON lists(is_shared);
      CREATE INDEX IF NOT EXISTS idx_lists_last_updated ON lists(last_updated);
      CREATE INDEX IF NOT EXISTS idx_lists_version ON lists(version);
      CREATE INDEX IF NOT EXISTS idx_lists_server_version ON lists(server_version);
      CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_changes(status);
      CREATE INDEX IF NOT EXISTS idx_pending_changes_entity_id ON pending_changes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
      CREATE INDEX IF NOT EXISTS idx_id_mappings_temp_id ON id_mappings(temp_id);
      CREATE INDEX IF NOT EXISTS idx_id_mappings_actual_id ON id_mappings(actual_id);
      CREATE INDEX IF NOT EXISTS idx_id_mappings_status ON id_mappings(status);
    `);
  }

  // Auth operations
  async saveAuthData(token: string | null, userData: any | null): Promise<void> {
    await db.execAsync('DELETE FROM auth');
    
    await db.runAsync(
      'INSERT INTO auth (token, user_data) VALUES (?, ?)',
      [token, userData ? JSON.stringify(userData) : null]
    );
  }

  async getAuthData(): Promise<{ token: string | null; userData: any | null }> {
    const result = await db.getFirstAsync<{ token: string; user_data: string }>(
      'SELECT token, user_data FROM auth LIMIT 1'
    );

    if (result) {
      return {
        token: result.token,
        userData: result.user_data ? JSON.parse(result.user_data) : null
      };
    }

    return { token: null, userData: null };
  }

  // Settings operations
  async saveSettings(settings: Settings): Promise<void> {
    try {
      // Save theme setting
      if (settings.theme !== undefined) {
        await db.runAsync(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['theme', settings.theme]
        );
        console.log('[Database] Theme setting saved:', settings.theme);
      }

      // Save notification settings
      const notificationSettings = {
        notifications_enabled: settings.notificationsEnabled,
        title_change_notifications: settings.titleChangeNotifications,
        item_add_notifications: settings.itemAddNotifications,
        item_delete_notifications: settings.itemDeleteNotifications,
        item_edit_notifications: settings.itemEditNotifications,
        item_complete_notifications: settings.itemCompleteNotifications
      };

      for (const [key, value] of Object.entries(notificationSettings)) {
        if (value !== undefined) {
          await db.runAsync(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            [key, value.toString()]
          );
          console.log(`[Database] ${key} setting saved:`, value);
        }
      }
    } catch (error) {
      console.error('[Database] Error saving settings:', error);
      throw error;
    }
  }

  async getSettings(): Promise<Settings> {
    try {
      const settings: Settings = {
        theme: 'light', // Default theme
        notificationsEnabled: true,
        titleChangeNotifications: true,
        itemAddNotifications: true,
        itemDeleteNotifications: true,
        itemEditNotifications: true,
        itemCompleteNotifications: true
      };

      const rows = await db.getAllAsync<{ key: string; value: string }>(
        'SELECT key, value FROM settings'
      );

      rows.forEach(row => {
        switch (row.key) {
          case 'theme':
            settings.theme = row.value as 'light' | 'dark';
            break;
          case 'notifications_enabled':
            settings.notificationsEnabled = row.value === 'true';
            break;
          case 'title_change_notifications':
            settings.titleChangeNotifications = row.value === 'true';
            break;
          case 'item_add_notifications':
            settings.itemAddNotifications = row.value === 'true';
            break;
          case 'item_delete_notifications':
            settings.itemDeleteNotifications = row.value === 'true';
            break;
          case 'item_edit_notifications':
            settings.itemEditNotifications = row.value === 'true';
            break;
          case 'item_complete_notifications':
            settings.itemCompleteNotifications = row.value === 'true';
            break;
        }
      });

      console.log('[Database] Settings loaded:', settings);
      return settings;
    } catch (error) {
      console.error('[Database] Error loading settings:', error);
      throw error;
    }
  }

  // Lists operations
  async saveLists(lists: any[], isShared: boolean = false): Promise<void> {
    await db.withTransactionAsync(async () => {
      for (const list of lists) {
        const currentList = await db.getFirstAsync<{ version: number, server_version: number }>(
          'SELECT version, server_version FROM lists WHERE id = ?',
          [list.id]
        );

        const version = currentList ? currentList.version + 1 : 1;
        const serverVersion = list.version || (currentList ? currentList.server_version : 1);

        await db.runAsync(
          'INSERT OR REPLACE INTO lists (id, data, last_updated, is_shared, version, server_version) VALUES (?, ?, ?, ?, ?, ?)',
          [list.id, JSON.stringify(list), Date.now(), isShared ? 1 : 0, version, serverVersion]
        );
      }
    });
  }

  async getLists(isShared: boolean = false): Promise<any[]> {
    const results = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM lists WHERE is_shared = ? ORDER BY last_updated DESC',
      [isShared ? 1 : 0]
    );

    return results.map(row => JSON.parse(row.data));
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
  async addPendingChange(actionType: string, entityId: string, data: any): Promise<void> {
    console.log('[Database Debug] Adding pending change:', {
      type: actionType,
      entityId: entityId.substring(0, 8),
      dataKeys: Object.keys(data),
      timestamp: Date.now()
    });

    const currentList = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM lists WHERE id = ?',
      [entityId]
    );

    console.log('[Database Debug] Current list state:', {
      entityId: entityId.substring(0, 8),
      found: !!currentList,
      version: currentList?.version
    });

    await db.runAsync(
      'INSERT INTO pending_changes (action_type, entity_id, data, timestamp, base_version) VALUES (?, ?, ?, ?, ?)',
      [actionType, entityId, JSON.stringify(data), Date.now(), currentList?.version || 1]
    );

    // Verify the change was added
    const addedChange = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM pending_changes WHERE entity_id = ? AND action_type = ? ORDER BY id DESC LIMIT 1',
      [entityId, actionType]
    );

    console.log('[Database Debug] Pending change added:', {
      success: !!addedChange,
      changeId: addedChange?.id,
      entityId: entityId.substring(0, 8)
    });
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
    console.log('[Database Debug] Fetching pending changes');

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

    // Group changes by entity for better debugging
    const changesByEntity = new Map<string, PendingChangeRow[]>();
    results.forEach(row => {
      const existing = changesByEntity.get(row.entity_id) || [];
      changesByEntity.set(row.entity_id, [...existing, row]);
    });

    console.log('[Database Debug] Pending changes summary:', {
      total: results.length,
      byEntity: Array.from(changesByEntity.entries()).map(([entityId, changes]) => ({
        entityId: entityId.substring(0, 8),
        count: changes.length,
        types: changes.map(c => c.action_type),
        versions: changes.map(c => c.base_version)
      }))
    });

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
    console.log('[Database Debug] Updating change status:', {
      changeId: id,
      newStatus: status,
      retries
    });

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

    // Verify the update
    const updatedChange = await db.getFirstAsync<{ status: string, retries: number }>(
      'SELECT status, retries FROM pending_changes WHERE id = ?',
      [id]
    );

    console.log('[Database Debug] Change status updated:', {
      changeId: id,
      success: updatedChange?.status === status,
      currentStatus: updatedChange?.status,
      retries: updatedChange?.retries
    });
  }

  async removePendingChange(id: number): Promise<void> {
    console.log('[Database Debug] Removing pending change:', { changeId: id });

    // Get change details before removal
    const change = await db.getFirstAsync<{ entity_id: string, action_type: string }>(
      'SELECT entity_id, action_type FROM pending_changes WHERE id = ?',
      [id]
    );

    await db.runAsync('DELETE FROM pending_changes WHERE id = ?', [id]);

    // Verify removal
    const remainingChange = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM pending_changes WHERE id = ?',
      [id]
    );

    console.log('[Database Debug] Pending change removed:', {
      changeId: id,
      success: !remainingChange,
      entityId: change?.entity_id.substring(0, 8),
      type: change?.action_type
    });
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
      `);
    });
  }

  async updatePendingChangeEntityId(changeId: number, newEntityId: string) {
    console.log('[Database] Updating pending change entity ID:', {
      changeId,
      newEntityId
    });
    
    await db.runAsync(
      `UPDATE pending_changes 
       SET entity_id = ? 
       WHERE id = ?`,
      [newEntityId, changeId]
    );
  }

  async incrementChangeRetry(changeId: number): Promise<void> {
    console.log('[Database] Incrementing retry count for change:', changeId);
    
    await db.runAsync(
      `UPDATE pending_changes 
       SET retries = retries + 1 
       WHERE id = ?`,
      [changeId]
    );
  }

  // ID Mapping operations
  async saveIdMapping(tempId: string, actualId: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    console.log('[Database Debug] Saving ID mapping:', {
      tempId: tempId.substring(0, 8),
      actualId: actualId.substring(0, 8),
      status
    });

    const now = Date.now();
    await db.runAsync(
      `INSERT OR REPLACE INTO id_mappings 
       (temp_id, actual_id, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [tempId, actualId, status, now, now]
    );

    // Verify the mapping was saved
    const savedMapping = await db.getFirstAsync<{ temp_id: string, actual_id: string, status: string }>(
      'SELECT temp_id, actual_id, status FROM id_mappings WHERE temp_id = ? OR actual_id = ?',
      [tempId, actualId]
    );

    console.log('[Database Debug] ID mapping saved:', {
      success: !!savedMapping,
      tempId: savedMapping?.temp_id.substring(0, 8),
      actualId: savedMapping?.actual_id.substring(0, 8),
      status: savedMapping?.status
    });
  }

  async getIdMapping(id: string): Promise<{ tempId: string; actualId: string; status: string } | null> {
    console.log('[Database Debug] Looking up ID mapping:', {
      id: id.substring(0, 8)
    });

    const mapping = await db.getFirstAsync<{ temp_id: string; actual_id: string; status: string }>(
      'SELECT temp_id, actual_id, status FROM id_mappings WHERE temp_id = ? OR actual_id = ?',
      [id, id]
    );

    console.log('[Database Debug] ID mapping lookup result:', {
      id: id.substring(0, 8),
      found: !!mapping,
      mapping: mapping ? {
        tempId: mapping.temp_id.substring(0, 8),
        actualId: mapping.actual_id.substring(0, 8),
        status: mapping.status
      } : null
    });

    return mapping ? {
      tempId: mapping.temp_id,
      actualId: mapping.actual_id,
      status: mapping.status
    } : null;
  }

  async getAllIdMappings(): Promise<Array<{ tempId: string; actualId: string; status: string }>> {
    console.log('[Database Debug] Fetching all ID mappings');

    const mappings = await db.getAllAsync<{ temp_id: string; actual_id: string; status: string }>(
      'SELECT temp_id, actual_id, status FROM id_mappings'
    );

    console.log('[Database Debug] ID mappings summary:', {
      total: mappings.length,
      byStatus: mappings.reduce((acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      mappings: mappings.map(m => ({
        tempId: m.temp_id.substring(0, 8),
        actualId: m.actual_id.substring(0, 8),
        status: m.status
      }))
    });

    return mappings.map(m => ({
      tempId: m.temp_id,
      actualId: m.actual_id,
      status: m.status
    }));
  }

  async updateIdMappingStatus(id: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    console.log('[Database Debug] Updating ID mapping status:', {
      id: id.substring(0, 8),
      newStatus: status
    });

    await db.runAsync(
      `UPDATE id_mappings 
       SET status = ?, updated_at = ? 
       WHERE temp_id = ? OR actual_id = ?`,
      [status, Date.now(), id, id]
    );

    // Verify the update
    const updatedMapping = await db.getFirstAsync<{ status: string }>(
      'SELECT status FROM id_mappings WHERE temp_id = ? OR actual_id = ?',
      [id, id]
    );

    console.log('[Database Debug] ID mapping status updated:', {
      id: id.substring(0, 8),
      success: updatedMapping?.status === status,
      currentStatus: updatedMapping?.status
    });
  }

  async removeIdMapping(tempId: string): Promise<void> {
    console.log('[Database Debug] Removing ID mapping:', {
      tempId: tempId.substring(0, 8)
    });

    await db.runAsync(
      'DELETE FROM id_mappings WHERE temp_id = ?',
      [tempId]
    );

    console.log('[Database Debug] ID mapping removed:', {
      tempId: tempId.substring(0, 8)
    });
  }
}

export const databaseService = new DatabaseService();
export default databaseService; 