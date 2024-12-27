import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { databaseService } from './src/services/database';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Initialize database
databaseService;

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
		<SafeAreaProvider>
			<NavigationContainer>
				<StatusBar style="auto" />
				<RootNavigator />
			</NavigationContainer>
		</SafeAreaProvider>
      </ThemeProvider>
    </Provider>
  );
}
