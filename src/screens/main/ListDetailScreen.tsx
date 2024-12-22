import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { fetchListById, updateList } from '../../store/actions/listActions';
import { DraggableList } from '../../components/DraggableList';
import { theme } from '../../constants/theme';
import { ListStackScreenProps } from '../../navigation/types';
import socketService from '../../services/socket';

export default function ListDetailScreen() {
  const route = useRoute<ListStackScreenProps<'ListDetail'>['route']>();
  const dispatch = useAppDispatch();
  const { currentList, loading } = useAppSelector((state) => state.lists);
  const { listId } = route.params;

  // Join room when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('[ListDetailScreen] Screen focused, joining room for list:', listId);
      socketService.joinList(listId);
      
      return () => {
        console.log('[ListDetailScreen] Screen unfocused, leaving room for list:', listId);
        socketService.leaveList(listId);
      };
    }, [listId])
  );

  // Load list data
  useEffect(() => {
    console.log('[ListDetailScreen] Component mounted, listId:', listId);
    
    const loadList = async () => {
      try {
        console.log('[ListDetailScreen] Loading list data...');
        await dispatch(fetchListById(listId));
        console.log('[ListDetailScreen] List data loaded successfully');
      } catch (error) {
        console.error('[ListDetailScreen] Error loading list:', error);
      }
    };

    loadList();
  }, [listId, dispatch]);

  // Listen for WebSocket events
  useEffect(() => {
    if (!socketService.socket) {
      console.warn('[ListDetailScreen] Socket not available for list:', listId);
      return;
    }

    console.log('[ListDetailScreen] Setting up WebSocket listeners for list:', listId);
    
    const onListUpdated = (data: any) => {
      console.log('[ListDetailScreen] Received list update:', {
        listId: data.listId,
        type: data.type,
        updatedBy: data.updatedBy
      });
      
      // Only refresh if the update is for our list
      if (data.listId === listId) {
        console.log('[ListDetailScreen] Refreshing list data after update');
        dispatch(fetchListById(listId));
      }
    };

    socketService.socket.on('listUpdated', onListUpdated);
    console.log('[ListDetailScreen] WebSocket listeners set up successfully');

    return () => {
      console.log('[ListDetailScreen] Cleaning up WebSocket listeners');
      socketService.socket?.off('listUpdated', onListUpdated);
    };
  }, [listId, dispatch]);

  const handleToggleItem = async (itemId: string) => {
    if (!currentList) return;

    try {
      console.log('[ListDetailScreen] Toggling item:', itemId);
      const updatedItems = currentList.items.map(item => {
        if (item._id === itemId) {
          return { ...item, completed: !item.completed };
        }
        return item;
      });

      console.log('[ListDetailScreen] Dispatching updateList with updated items');
      await dispatch(updateList(currentList._id, { items: updatedItems }));
      console.log('[ListDetailScreen] List update dispatched successfully');
    } catch (error) {
      console.error('[ListDetailScreen] Error toggling item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!currentList) return;

    try {
      console.log('[ListDetailScreen] Deleting item:', itemId);
      const updatedItems = currentList.items.filter(item => item._id !== itemId);
      await dispatch(updateList(currentList._id, { items: updatedItems }));
      console.log('[ListDetailScreen] Item deleted successfully');
    } catch (error) {
      console.error('[ListDetailScreen] Error deleting item:', error);
    }
  };

  const handleEditItem = async (itemId: string, newText: string) => {
    if (!currentList) return;

    try {
      console.log('[ListDetailScreen] Editing item:', itemId, 'New text:', newText);
      const updatedItems = currentList.items.map(item => 
        item._id === itemId ? { ...item, text: newText } : item
      );
      await dispatch(updateList(currentList._id, { items: updatedItems }));
      console.log('[ListDetailScreen] Item edited successfully');
    } catch (error) {
      console.error('[ListDetailScreen] Error editing item:', error);
    }
  };

  if (!currentList) {
    console.log('[ListDetailScreen] No current list available');
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