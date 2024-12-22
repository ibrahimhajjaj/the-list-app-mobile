import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { GripVertical, Pencil, Trash2, Check, X, Save } from 'lucide-react-native';
import { theme } from '../constants/theme';

interface ListItemProps {
  text: string;
  completed: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
  editButtonStyle?: object;
  deleteButtonStyle?: object;
  drag?: () => void;
  isActive?: boolean;
}

export function ListItem({ 
  text, 
  completed, 
  onToggle, 
  onDelete, 
  onEdit,
  editButtonStyle,
  deleteButtonStyle,
  drag,
  isActive
}: ListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(text);

  const handleSave = () => {
    if (editedText.trim() !== text) {
      onEdit(editedText.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(text);
    setIsEditing(false);
  };

  return (
    <View style={[
      styles.container,
      isActive && styles.dragging
    ]}>
      <TouchableOpacity 
        style={styles.dragHandle}
        onPressIn={drag}
      >
        <GripVertical size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[
          styles.checkbox,
          completed && styles.checkboxChecked
        ]} 
        onPress={onToggle}
      >
        {completed && (
          <Check size={14} color="#FFFFFF" strokeWidth={3} />
        )}
      </TouchableOpacity>
      
      {isEditing ? (
        <TextInput
          style={styles.input}
          value={editedText}
          onChangeText={setEditedText}
          autoFocus
          onSubmitEditing={handleSave}
          onBlur={() => {
            if (editedText === text) {
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <Text style={[
          styles.text,
          completed && styles.textCompleted
        ]}>
          {text}
        </Text>
      )}
      
      <View style={styles.actions}>
        {isEditing ? (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, editButtonStyle]} 
              onPress={handleSave}
            >
              <Save size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, editButtonStyle]} 
              onPress={handleCancel}
            >
              <X size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, editButtonStyle]} 
              onPress={() => setIsEditing(true)}
            >
              <Pencil size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, deleteButtonStyle]} 
              onPress={onDelete}
            >
              <Trash2 size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.s,
    gap: theme.spacing.s,
    backgroundColor: theme.colors.background,
  },
  dragging: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.medium,
  },
  dragHandle: {
    padding: theme.spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
  },
}); 