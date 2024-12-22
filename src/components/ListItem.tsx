import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { GripVertical, Pencil, Trash2, Check, X, Save } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';

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
  const colors = useThemeColors();

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
      { backgroundColor: colors.background },
      isActive && [styles.dragging, { backgroundColor: colors.accent }]
    ]}>
      <TouchableOpacity 
        style={styles.dragHandle}
        onPressIn={drag}
      >
        <GripVertical size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[
          styles.checkbox,
          { borderColor: colors.border },
          completed && { backgroundColor: colors.primary, borderColor: colors.primary }
        ]} 
        onPress={onToggle}
      >
        {completed && (
          <Check size={14} color={colors.primaryForeground} strokeWidth={3} />
        )}
      </TouchableOpacity>
      
      {isEditing ? (
        <TextInput
          style={[
            styles.input,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.accent
            }
          ]}
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
          { color: colors.foreground },
          completed && { color: colors.mutedForeground, textDecorationLine: 'line-through' }
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
              <Save size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, editButtonStyle]} 
              onPress={handleCancel}
            >
              <X size={18} color={colors.foreground} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.actionButton, editButtonStyle]} 
              onPress={() => setIsEditing(true)}
            >
              <Pencil size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, deleteButtonStyle]} 
              onPress={onDelete}
            >
              <Trash2 size={18} color={colors.destructiveForeground} />
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
  },
  dragging: {
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
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
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xs,
  },
}); 