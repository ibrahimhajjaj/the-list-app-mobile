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

      -- Create indices for frequently queried columns
      CREATE INDEX IF NOT EXISTS idx_lists_is_shared ON lists(is_shared);
      CREATE INDEX IF NOT EXISTS idx_lists_last_updated ON lists(last_updated);
      CREATE INDEX IF NOT EXISTS idx_lists_version ON lists(version);
      CREATE INDEX IF NOT EXISTS idx_lists_server_version ON lists(server_version);
      CREATE INDEX IF NOT EXISTS idx_pending_changes_status ON pending_changes(status);
      CREATE INDEX IF NOT EXISTS idx_pending_changes_entity_id ON pending_changes(entity_id);
      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
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
      `);
    });
  }
}

export const databaseService = new DatabaseService();
export default databaseService; 