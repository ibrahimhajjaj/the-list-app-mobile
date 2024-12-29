import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store } from './store';
import { RootNavigator } from './navigation/RootNavigator';
import { loadSettings, setSettings } from './store/slices/settingsSlice';

function AppContent() {
  useEffect(() => {
    // Initialize settings
    const initSettings = async () => {
      const settings = await loadSettings();
      store.dispatch(setSettings(settings));
      console.log('[App] Settings initialized:', settings);
    };

    initSettings();
  }, []);

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
} 