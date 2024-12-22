import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchListById, updateList } from '../../store/actions/listActions';
import { DraggableList } from '../../components/DraggableList';
import { theme } from '../../constants/theme';
import { ListStackScreenProps } from '../../navigation/types';
import socketService from '../../services/socket';
import { List } from '../../store/slices/listSlice';

export default function ListDetailScreen() {
  const route = useRoute<ListStackScreenProps<'ListDetail'>['route']>();
  const dispatch = useAppDispatch();
  const { currentList, loading } = useAppSelector((state) => state.lists);
  const { listId } = route.params;

  useEffect(() => {
    loadList();
    // Join the list's WebSocket room
    socketService.joinList(listId);

    // Cleanup: leave the room when unmounting
    return () => {
      socketService.leaveList(listId);
    };
  }, [listId]);

  const loadList = async () => {
    try {
      await dispatch(fetchListById(listId));
    } catch (error) {
      console.error('Error loading list:', error);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    if (!currentList) return;

    try {
      const updatedItems = currentList.items.map(item => 
        item._id === itemId ? { ...item, completed: !item.completed } : item
      );

      console.log('Updating list items:', updatedItems);
      await dispatch(updateList(currentList._id, { items: updatedItems }));
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!currentList) return;

    try {
      const updatedItems = currentList.items.filter(item => item._id !== itemId);
      await dispatch(updateList(currentList._id, { items: updatedItems }));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleEditItem = async (itemId: string, newText: string) => {
    if (!currentList) return;

    try {
      const updatedItems = currentList.items.map(item => 
        item._id === itemId ? { ...item, text: newText } : item
      );
      await dispatch(updateList(currentList._id, { items: updatedItems }));
    } catch (error) {
      console.error('Error editing item:', error);
    }
  };

  if (!currentList) {
    return null;
  }

  return (
    <View style={styles.container}>
      <DraggableList
        items={currentList.items}
        onToggle={handleToggleItem}
        onDelete={handleDeleteItem}
        onEdit={handleEditItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.m,
  },
}); 