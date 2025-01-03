import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  Auth: {
    needsPermissions?: boolean;
  };
  Main: undefined;
};

export type AuthStackParamList = {
  Splash: undefined;
  Permissions: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

export type MainTabParamList = {
  Lists: undefined;
  Profile: undefined;
};

export type ListStackParamList = {
  ListsHome: undefined;
  ListDetail: {
    listId: string;
    title: string;
    isShared?: boolean;
  };
  CreateList: {
    title?: string;
  };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type ListStackScreenProps<T extends keyof ListStackParamList> = NativeStackScreenProps<
  ListStackParamList,
  T
>; 