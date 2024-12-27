import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../services/storage';

type ThemeType = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>(systemColorScheme || 'light');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved theme preference on mount
  useEffect(() => {
    async function loadThemePreference() {
      try {
        const settings = await storage.getSettings();
        if (settings?.theme) {
          console.log('[ThemeContext] Loading saved theme:', settings.theme);
          setTheme(settings.theme);
        } else {
          console.log('[ThemeContext] No saved theme, using system default:', systemColorScheme);
          setTheme(systemColorScheme || 'light');
        }
      } catch (error) {
        console.error('[ThemeContext] Error loading theme:', error);
        // Fallback to system preference
        setTheme(systemColorScheme || 'light');
      } finally {
        setIsInitialized(true);
      }
    }

    loadThemePreference();
  }, [systemColorScheme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      // Save theme preference
      await storage.saveSettings({ theme: newTheme });
      console.log('[ThemeContext] Theme preference saved:', newTheme);
    } catch (error) {
      console.error('[ThemeContext] Error saving theme:', error);
    }
  };

  // Don't render until we've loaded the saved theme
  if (!isInitialized) {
    return null;
  }

  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark'
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
} 