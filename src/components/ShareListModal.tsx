import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { useAppDispatch } from '../hooks/redux';
import { shareList } from '../store/actions/listActions';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';

interface ShareListModalProps {
  listId: string;
  visible: boolean;
  onClose: () => void;
}

export function ShareListModal({ listId, visible, onClose }: ShareListModalProps) {
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState('');
  const [shareType, setShareType] = useState<'view' | 'edit'>('view');
  const [isLoading, setIsLoading] = useState(false);
  const colors = useThemeColors();

  const handleShare = async () => {
    if (!email.trim()) return;

    try {
      setIsLoading(true);
      console.log('Sharing list:', { listId, email, permission: shareType });
      
      const result = await dispatch(shareList({ 
        listId, 
        data: { email, permission: shareType } 
      })).unwrap();
      
      console.log('List shared successfully:', result);
      
      Alert.alert(
        'Success',
        'List shared successfully',
        [{ text: 'OK', onPress: onClose }]
      );
      setEmail('');
    } catch (error: any) {
      console.error('Error sharing list:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to share list. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Share List</Text>
          
          <View style={styles.permissionButtons}>
            <TouchableOpacity 
              style={[
                styles.permissionButton,
                { 
                  borderColor: colors.border,
                  backgroundColor: shareType === 'view' ? colors.primary : colors.background
                }
              ]}
              onPress={() => setShareType('view')}
            >
              <Text style={[
                styles.permissionButtonText,
                { color: shareType === 'view' ? colors.primaryForeground : colors.foreground }
              ]}>View Only</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.permissionButton,
                { 
                  borderColor: colors.border,
                  backgroundColor: shareType === 'edit' ? colors.primary : colors.background
                }
              ]}
              onPress={() => setShareType('edit')}
            >
              <Text style={[
                styles.permissionButtonText,
                { color: shareType === 'edit' ? colors.primaryForeground : colors.foreground }
              ]}>Can Edit</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.foreground
              }
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email address"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[
                styles.button,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1
                }
              ]} 
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, { color: colors.foreground }]}>
                Close
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: (!email || isLoading) ? 0.5 : 1
                }
              ]} 
              onPress={handleShare}
              disabled={!email || isLoading}
            >
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                {isLoading ? 'Sharing...' : 'Share'}
              </Text>
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
    fontSize: 24,
    fontWeight: 'bold',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    fontSize: 14,
    marginBottom: theme.spacing.l,
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
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 