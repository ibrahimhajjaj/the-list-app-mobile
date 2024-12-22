import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[
                styles.button, 
                { 
                  backgroundColor: colors.background,
                  borderColor: colors.border
                }
              ]} 
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.button, 
                { backgroundColor: colors.destructive }
              ]} 
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, { color: colors.destructiveForeground }]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.l,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: theme.spacing.s,
  },
  message: {
    fontSize: 14,
    marginBottom: theme.spacing.l,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.m,
  },
  button: {
    flex: 1,
    height: theme.buttons.sizes.default.height,
    paddingHorizontal: theme.buttons.sizes.default.paddingHorizontal,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 