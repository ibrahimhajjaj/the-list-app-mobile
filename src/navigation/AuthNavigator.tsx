import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import { PermissionsScreen } from '../screens/auth/PermissionsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { useRoute } from '@react-navigation/native';
import type { RootStackScreenProps } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const route = useRoute<RootStackScreenProps<'Auth'>['route']>();
  const needsPermissions = route.params?.needsPermissions;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={needsPermissions ? "Permissions" : "Login"}
    >
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
} 