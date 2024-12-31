import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { loginUser, clearError } from '../../store/slices/authSlice';
import { theme } from '../../constants/theme';
import { useThemeColors } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('ibrhajjaj@gmail.com');
  const [password, setPassword] = useState('12341234');
  const dispatch = useAppDispatch();
  const { loading, error, token, user } = useAppSelector((state) => state.auth);
  const colors = useThemeColors();

  // Clear any auth errors when component mounts or unmounts
  useEffect(() => {
    console.log('[Login] Component mounted, clearing errors');
    dispatch(clearError());
    return () => {
      console.log('[Login] Component unmounting, clearing errors');
      dispatch(clearError());
    };
  }, [dispatch]);

  useEffect(() => {
    console.log('[Login] Auth state changed:', {
      loading,
      hasError: !!error,
      hasToken: !!token,
      hasUser: !!user
    });
  }, [loading, error, token, user]);

  const handleLogin = async () => {
    if (!email || !password) {
      console.log('[Login] Validation failed: missing email or password');
      return;
    }

    console.log('[Login] Attempting login with email:', email);
    try {
      const resultAction = await dispatch(loginUser({ email, password })).unwrap();
      if (loginUser.fulfilled.match(resultAction)) {
        console.log('[Login] Login successful, user:', resultAction.user?._id);
      }
    } catch (err: any) {
      console.error('[Login] Login failed:', {
        error: err?.message,
        details: err?.response?.data,
        status: err?.response?.status
      });
    }
  };

  const navigateToRegister = () => {
    console.log('[Login] Navigating to register screen');
    dispatch(clearError());
    navigation.navigate('Register');
  };

  // Only show user-facing errors
  const shouldShowError = error && error !== 'No token found';
  
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/app-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.formContainer}>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome Back</Text>
          
          {shouldShowError && (
            <View style={[styles.errorContainer, { backgroundColor: colors.destructive + '15' }]}>
              <Text style={[styles.errorText, { color: colors.secondary }]}>{error}</Text>
            </View>
          )}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.loginButton,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.loginButtonText, { color: colors.primaryForeground }]}>
                Login
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerContainer}>
            <Text style={[styles.registerText, { color: colors.mutedForeground }]}>
              Don't have an account?
            </Text>
            <TouchableOpacity onPress={navigateToRegister}>
              <Text style={[styles.registerLink, { color: colors.primary }]}>
                Register here
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.l,
  },
  title: {
    fontSize: theme.typography.fontSize.h1,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.l,
    textAlign: 'center',
  },
  errorContainer: {
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    marginBottom: theme.spacing.m,
  },
  errorText: {
    fontSize: theme.typography.fontSize.body,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    fontSize: theme.typography.fontSize.body,
  },
  loginButton: {
    height: theme.buttons.sizes.large.height,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.m,
  },
  loginButtonText: {
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.bold,
  },
  registerContainer: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.s,
  },
  registerText: {
    fontSize: theme.typography.fontSize.body,
  },
  registerLink: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    textDecorationLine: 'underline',
  },
  forgotPasswordText: {
    fontSize: theme.typography.fontSize.body,
    textAlign: 'right',
    marginBottom: theme.spacing.m,
    fontWeight: theme.typography.fontWeight.medium,
  },
}); 