import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal } from 'react-native';
import { theme } from '../constants/theme';

interface ShareListModalProps {
  listId: string;
  visible: boolean;
  onClose: () => void;
}

export function ShareListModal({ listId, visible, onClose }: ShareListModalProps) {
  const [email, setEmail] = useState('');
  const [shareType, setShareType] = useState<'view' | 'edit'>('view');

  const handleShare = () => {
    // TODO: Implement share functionality
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Share List</Text>
          
          <View style={styles.permissionButtons}>
            <TouchableOpacity 
              style={[
                styles.permissionButton,
                shareType === 'view' && styles.permissionButtonSelected
              ]}
              onPress={() => setShareType('view')}
            >
              <Text style={[
                styles.permissionButtonText,
                shareType === 'view' && styles.permissionButtonTextSelected
              ]}>View Only</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.permissionButton,
                shareType === 'edit' && styles.permissionButtonSelected
              ]}
              onPress={() => setShareType('edit')}
            >
              <Text style={[
                styles.permissionButtonText,
                shareType === 'edit' && styles.permissionButtonTextSelected
              ]}>Can Edit</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.closeButton]} 
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.shareButton, !email && styles.shareButtonDisabled]} 
              onPress={handleShare}
              disabled={!email}
            >
              <Text style={styles.shareButtonText}>Share</Text>
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
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.l,
    padding: theme.spacing.l,
    width: '90%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.l,
    textAlign: 'center',
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.m,
    marginBottom: theme.spacing.l,
  },
  permissionButton: {
    flex: 1,
    height: theme.buttons.sizes.default.height,
    paddingHorizontal: theme.buttons.sizes.default.paddingHorizontal,
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: theme.colors.text,
  },
  permissionButtonTextSelected: {
    color: theme.colors.background,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    fontSize: 14,
    marginBottom: theme.spacing.l,
    color: theme.colors.text,
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
  },
  closeButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  shareButton: {
    backgroundColor: theme.colors.primary,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.background,
  },
}); 