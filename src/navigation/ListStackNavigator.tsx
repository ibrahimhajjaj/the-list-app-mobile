import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ListStackParamList } from './types';
import ListsScreen from '../screens/main/ListsScreen';

const Stack = createNativeStackNavigator<ListStackParamList>();

export default function ListStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
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