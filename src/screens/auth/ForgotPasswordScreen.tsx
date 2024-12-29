import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemeColors } from '../../constants/theme';
import { AuthStackScreenProps } from '../../navigation/types';
import { api } from '../../services/api';
import { theme } from '../../constants/theme';
import OTPInput from '../../components/OTPInput';

type Step = 'email' | 'otp' | 'password';

export default function ForgotPasswordScreen({ navigation }: AuthStackScreenProps<'ForgotPassword'>) {
  const [email, setEmail] = useState('');
  const [otp, setOTP] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [otpVerified, setOtpVerified] = useState(false);
  const colors = useThemeColors();

  // Auto-verify OTP when it's complete
  useEffect(() => {
    if (otp.length === 8 && !otpVerified) {
      handleVerifyOTP();
    }
  }, [otp]);

  const handleRequestReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await api.post('/users/request-reset', { email });
      setCurrentStep('otp');
    } catch (error) {
      Alert.alert('Error', 'Failed to process password reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setLoading(true);
      await api.post('/users/verify-otp', { email, otp });
      setOtpVerified(true);
      setCurrentStep('password');
    } catch (error) {
      setOTP(''); // Clear invalid OTP
      Alert.alert('Error', 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      await api.post('/users/reset-password', {
        email,
        otp,
        newPassword
      });
      Alert.alert(
        'Success',
        'Your password has been reset successfully',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'email':
        return (
          <>
            <Text style={[styles.title, { color: colors.foreground }]} variant="headlineMedium">
              Forgot Password
            </Text>
            
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} variant="bodyLarge">
              Enter your email address and we'll send you a code to reset your password.
            </Text>

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
              autoComplete="email"
            />

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
              onPress={handleRequestReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                  Send Reset Code
                </Text>
              )}
            </TouchableOpacity>
          </>
        );

      case 'otp':
        return (
          <>
            <Text style={[styles.title, { color: colors.foreground }]} variant="headlineMedium">
              Enter Reset Code
            </Text>
            
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} variant="bodyLarge">
              Enter the 8-character code sent to your email.
            </Text>

            <OTPInput
              value={otp}
              onChange={setOTP}
              length={8}
            />

            {loading && (
              <ActivityIndicator 
                style={styles.loader} 
                color={colors.primary}
              />
            )}
          </>
        );

      case 'password':
        return (
          <>
            <Text style={[styles.title, { color: colors.foreground }]} variant="headlineMedium">
              Reset Password
            </Text>
            
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} variant="bodyLarge">
              Enter your new password below.
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="New Password"
              placeholderTextColor={colors.mutedForeground}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
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
              placeholder="Confirm Password"
              placeholderTextColor={colors.mutedForeground}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: loading ? 0.7 : 1,
                },
              ]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                  Reset Password
                </Text>
              )}
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {renderStep()}

          <TouchableOpacity
            style={[styles.linkButton]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Back to Login
            </Text>
          </TouchableOpacity>
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
  content: {
    flex: 1,
    padding: theme.spacing.l,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: theme.typography.fontSize.h1,
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.fontSize.body,
    marginBottom: theme.spacing.l,
    textAlign: 'center',
  },
  input: {
    height: theme.buttons.sizes.large.height,
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    fontSize: theme.typography.fontSize.body,
  },
  button: {
    height: theme.buttons.sizes.large.height,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.m,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.bold,
  },
  linkButton: {
    marginTop: theme.spacing.m,
    alignItems: 'center',
    padding: theme.spacing.s,
  },
  linkText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    textDecorationLine: 'underline',
  },
  loader: {
    marginTop: theme.spacing.m,
  },
}); 