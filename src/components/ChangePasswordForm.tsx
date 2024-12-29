import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemeColors } from '../constants/theme';
import { theme } from '../constants/theme';
import { api } from '../services/api';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const colors = useThemeColors();

  const handleChangePassword = async () => {
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    try {
      setLoading(true);
      await api.post('/users/change-password', {
        currentPassword,
        newPassword
      });

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert('Success', 'Password changed successfully');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to change password';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
        placeholder="Current Password"
        placeholderTextColor={colors.mutedForeground}
        value={currentPassword}
        onChangeText={setCurrentPassword}
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
        placeholder="Confirm New Password"
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
        onPress={handleChangePassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            Change Password
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.m,
    gap: theme.spacing.m,
  },
  input: {
    height: theme.buttons.sizes.large.height,
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    fontSize: theme.typography.fontSize.body,
  },
  button: {
    height: theme.buttons.sizes.large.height,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.s,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.bold,
  },
}); 