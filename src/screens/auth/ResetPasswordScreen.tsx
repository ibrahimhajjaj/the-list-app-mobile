import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemeColors } from '../../constants/theme';
import { AuthStackScreenProps } from '../../navigation/types';
import { api } from '../../services/api';
import { theme } from '../../constants/theme';

export default function ResetPasswordScreen({ 
  route,
  navigation 
}: AuthStackScreenProps<'ResetPassword'>) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = useThemeColors();
  const { token } = route.params;

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
        token,
        newPassword
      });
      Alert.alert(
        'Success',
        'Your password has been reset successfully',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
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
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
              Reset Password
            </Text>
          </TouchableOpacity>

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
}); 