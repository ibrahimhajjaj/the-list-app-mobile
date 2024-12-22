import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabParamList } from './types';
import ListStackNavigator from './ListStackNavigator';
import ProfileScreen from '../screens/main/ProfileScreen';

const Stack = createNativeStackNavigator<MainTabParamList>();

export default function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="Lists" 
        component={ListStackNavigator}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ headerShown: true }}
      />
    </Stack.Navigator>
  );
} 