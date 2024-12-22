import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { RootNavigator } from './navigation/RootNavigator';
import { loadSettings, setSettings } from './store/slices/settingsSlice';
import { useAppSelector } from './hooks/redux';
import socketService from './services/socket';

function AppContent() {
  const { token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // Initialize settings
    const initSettings = async () => {
      const settings = await loadSettings();
      store.dispatch(setSettings(settings));
      console.log('[App] Settings initialized:', settings);
    };

    initSettings();
  }, []);

  useEffect(() => {
    // Handle socket connection
    if (token) {
      console.log('[App] Connecting socket with token');
      socketService.connect(token);
    } else {
      console.log('[App] Disconnecting socket - no token');
      socketService.disconnect();
    }
  }, [token]);

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