import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { storage } from '../../services/storage';
import { Settings } from '../../types/settings';

const initialState: Settings = {
  theme: 'light',
  notificationsEnabled: true,
  titleChangeNotifications: true,
  itemAddNotifications: true,
  itemDeleteNotifications: true,
  itemEditNotifications: true,
  itemCompleteNotifications: true,
};

// Load settings from storage service
export const loadSettings = async () => {
  try {
    const settings = await storage.getSettings();
    console.log('[Settings] Loading settings from storage:', settings);
    return settings || initialState;
  } catch (error) {
    console.error('[Settings] Error loading settings:', error);
    return initialState;
  }
};

// Save settings using storage service
export const saveSettings = async (state: Settings) => {
  try {
    // Create a plain object copy of the state
    const settings: Settings = {
      theme: state.theme,
      notificationsEnabled: state.notificationsEnabled,
      titleChangeNotifications: state.titleChangeNotifications,
      itemAddNotifications: state.itemAddNotifications,
      itemDeleteNotifications: state.itemDeleteNotifications,
      itemEditNotifications: state.itemEditNotifications,
      itemCompleteNotifications: state.itemCompleteNotifications,
    };
    await storage.saveSettings(settings);
  } catch (error) {
    console.error('[Settings] Error saving settings:', error);
  }
};

// Check if a notification should be shown based on its type and current settings
export const shouldShowNotification = (
  settings: Settings,
  type: 'title_change' | 'item_add' | 'item_delete' | 'item_edit' | 'item_complete'
): boolean => {
  console.log('[Settings] Checking notification settings:', { type, settings });
  
  if (!settings.notificationsEnabled) {
    console.log('[Settings] Notifications are globally disabled');
    return false;
  }

  switch (type) {
    case 'title_change':
      return settings.titleChangeNotifications;
    case 'item_add':
      return settings.itemAddNotifications;
    case 'item_delete':
      return settings.itemDeleteNotifications;
    case 'item_edit':
      return settings.itemEditNotifications;
    case 'item_complete':
      return settings.itemCompleteNotifications;
    default:
      return true;
  }
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleNotifications: (state) => {
      state.notificationsEnabled = !state.notificationsEnabled;
      if (!state.notificationsEnabled) {
        state.titleChangeNotifications = false;
        state.itemAddNotifications = false;
        state.itemDeleteNotifications = false;
        state.itemEditNotifications = false;
        state.itemCompleteNotifications = false;
      } else {
        state.titleChangeNotifications = true;
        state.itemAddNotifications = true;
        state.itemDeleteNotifications = true;
        state.itemEditNotifications = true;
        state.itemCompleteNotifications = true;
      }
      // Create a plain object copy for saving
      const settings: Settings = {
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        titleChangeNotifications: state.titleChangeNotifications,
        itemAddNotifications: state.itemAddNotifications,
        itemDeleteNotifications: state.itemDeleteNotifications,
        itemEditNotifications: state.itemEditNotifications,
        itemCompleteNotifications: state.itemCompleteNotifications,
      };
      saveSettings(settings);
      console.log('[Settings] Notifications toggled:', state.notificationsEnabled);
    },
    toggleTitleChangeNotifications: (state) => {
      state.titleChangeNotifications = !state.titleChangeNotifications;
      const settings: Settings = {
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        titleChangeNotifications: state.titleChangeNotifications,
        itemAddNotifications: state.itemAddNotifications,
        itemDeleteNotifications: state.itemDeleteNotifications,
        itemEditNotifications: state.itemEditNotifications,
        itemCompleteNotifications: state.itemCompleteNotifications,
      };
      saveSettings(settings);
      console.log('[Settings] Title change notifications toggled:', state.titleChangeNotifications);
    },
    toggleItemAddNotifications: (state) => {
      state.itemAddNotifications = !state.itemAddNotifications;
      const settings: Settings = {
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        titleChangeNotifications: state.titleChangeNotifications,
        itemAddNotifications: state.itemAddNotifications,
        itemDeleteNotifications: state.itemDeleteNotifications,
        itemEditNotifications: state.itemEditNotifications,
        itemCompleteNotifications: state.itemCompleteNotifications,
      };
      saveSettings(settings);
      console.log('[Settings] Item add notifications toggled:', state.itemAddNotifications);
    },
    toggleItemDeleteNotifications: (state) => {
      state.itemDeleteNotifications = !state.itemDeleteNotifications;
      const settings: Settings = {
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        titleChangeNotifications: state.titleChangeNotifications,
        itemAddNotifications: state.itemAddNotifications,
        itemDeleteNotifications: state.itemDeleteNotifications,
        itemEditNotifications: state.itemEditNotifications,
        itemCompleteNotifications: state.itemCompleteNotifications,
      };
      saveSettings(settings);
      console.log('[Settings] Item delete notifications toggled:', state.itemDeleteNotifications);
    },
    toggleItemEditNotifications: (state) => {
      state.itemEditNotifications = !state.itemEditNotifications;
      const settings: Settings = {
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        titleChangeNotifications: state.titleChangeNotifications,
        itemAddNotifications: state.itemAddNotifications,
        itemDeleteNotifications: state.itemDeleteNotifications,
        itemEditNotifications: state.itemEditNotifications,
        itemCompleteNotifications: state.itemCompleteNotifications,
      };
      saveSettings(settings);
      console.log('[Settings] Item edit notifications toggled:', state.itemEditNotifications);
    },
    toggleItemCompleteNotifications: (state) => {
      state.itemCompleteNotifications = !state.itemCompleteNotifications;
      const settings: Settings = {
        theme: state.theme,
        notificationsEnabled: state.notificationsEnabled,
        titleChangeNotifications: state.titleChangeNotifications,
        itemAddNotifications: state.itemAddNotifications,
        itemDeleteNotifications: state.itemDeleteNotifications,
        itemEditNotifications: state.itemEditNotifications,
        itemCompleteNotifications: state.itemCompleteNotifications,
      };
      saveSettings(settings);
      console.log('[Settings] Item complete notifications toggled:', state.itemCompleteNotifications);
    },
    setSettings: (state, action: PayloadAction<Settings>) => {
      return { ...action.payload };
    },
  },
});

export const {
  toggleNotifications,
  toggleTitleChangeNotifications,
  toggleItemAddNotifications,
  toggleItemDeleteNotifications,
  toggleItemEditNotifications,
  toggleItemCompleteNotifications,
  setSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer; 