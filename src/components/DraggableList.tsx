import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ListItem } from './ListItem';
import { List } from '../store/slices/listSlice';
import { theme } from '../constants/theme';

interface Props {
  items: List['items'];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
}

export function DraggableList({ items, onToggle, onDelete, onEdit }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item) => (
        <ListItem
          key={item._id || `temp_${Date.now()}`}
          text={item.text}
          completed={item.completed}
          onToggle={() => item._id && onToggle(item._id)}
          onDelete={() => item._id && onDelete(item._id)}
          onEdit={(newText) => item._id && onEdit(item._id, newText)}
          editButtonStyle={theme.buttons.outline}
          deleteButtonStyle={theme.buttons.destructive}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
}); 