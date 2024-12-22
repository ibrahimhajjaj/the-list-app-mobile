import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ListStackParamList } from './types';
import ListsScreen from '../screens/main/ListsScreen';
import { theme } from '../constants/theme';

const Stack = createNativeStackNavigator<ListStackParamList>();

export default function ListStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="ListsHome"
        component={ListsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
} 