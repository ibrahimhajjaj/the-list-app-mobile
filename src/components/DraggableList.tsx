import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ListItem } from './ListItem';
import type { List, ListItem as ListItemType } from '../types/list';
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
      {items.map((item: ListItemType) => {
        return (
          <ListItem
            key={item._id}
            text={item.text}
            completed={item.completed}
            onToggle={() => {
              onToggle(item._id);
            }}
            onDelete={() => {
              onDelete(item._id);
            }}
            onEdit={(newText) => {
              onEdit(item._id, newText);
            }}
            editButtonStyle={theme.buttons.outline}
            deleteButtonStyle={theme.buttons.destructive}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
}); 