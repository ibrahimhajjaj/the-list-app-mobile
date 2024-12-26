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
import { AuthStackScreenProps } from '../../navigation/types';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { registerUser, clearError } from '../../store/slices/authSlice';
import { theme } from '../../constants/theme';
import { useThemeColors } from '../../constants/theme';

export default function RegisterScreen({ navigation }: AuthStackScreenProps<'Register'>) {
  const dispatch = useAppDispatch();
  const { loading, error, lastAttempt } = useAppSelector((state) => state.auth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const colors = useThemeColors();

  // Clear any auth errors when component mounts or unmounts
  useEffect(() => {
    dispatch(clearError());
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // Reset validation error when inputs change
  useEffect(() => {
    if (validationError) {
      setValidationError(null);
    }
  }, [name, email, password]);

  const validateInputs = (): boolean => {
    if (!name.trim()) {
      setValidationError('Please enter your name');
      return false;
    }
    if (!email.trim()) {
      setValidationError('Please enter your email');
      return false;
    }
    if (!password || password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      const resultAction = await dispatch(registerUser({ 
        name: name.trim(), 
        email: email.trim(), 
        password 
      })).unwrap();
      
      if (registerUser.fulfilled.match(resultAction)) {
        // Successfully registered, navigation will be handled by RootNavigator
        console.log('[Register] Registration successful');
      }
    } catch (err) {
      // Error is already handled by the auth slice
      console.error('[Register] Registration failed:', err);
    }
  };

  // Only show user-facing errors
  const shouldShowError = (error && error !== 'No token found') || validationError;
  const errorMessage = validationError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
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
          <Text style={[styles.title, { color: colors.foreground }]}>Create Account</Text>
          
          {shouldShowError && (
            <View style={[styles.errorContainer, { backgroundColor: colors.destructive + '15' }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {errorMessage}
              </Text>
              {lastAttempt?.details?.status && (
                <Text style={[styles.errorDetail, { color: colors.destructive }]}>
                  Status: {lastAttempt.details.status}
                </Text>
              )}
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
            placeholder="Name"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
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
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
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
          />
          
          <TouchableOpacity
            style={[
              styles.registerButton,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.registerButtonText, { color: colors.primaryForeground }]}>
                Register
              </Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.loginContainer}>
            <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
              Already have an account?
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.loginLink, { color: colors.primary }]}>
                Login here
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
  },
  errorDetail: {
    fontSize: theme.typography.fontSize.caption,
    marginTop: theme.spacing.s,
  },
  dismissText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    marginTop: theme.spacing.s,
    textAlign: 'right',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    fontSize: theme.typography.fontSize.body,
  },
  registerButton: {
    height: theme.buttons.sizes.large.height,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.m,
  },
  registerButtonText: {
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.bold,
  },
  loginContainer: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.s,
  },
  loginText: {
    fontSize: theme.typography.fontSize.body,
  },
  loginLink: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    textDecorationLine: 'underline',
  },
}); 