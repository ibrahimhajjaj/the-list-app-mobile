import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, TextInput, ScrollView, StatusBar } from 'react-native';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { ShareListModal } from '../../components/ShareListModal';
import { Pencil, Share2, Trash2, Save, X } from 'lucide-react-native';
import { theme } from '../../constants/theme';
import { useThemeColors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchLists, createList, updateList, deleteList } from '../../store/actions/listActions';
import { updateListItem, deleteListItem, addListItems } from '../../store/actions/listItemActions';
import type { List } from '../../types/list';
import { DraggableList } from '../../components/DraggableList';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { ListDropdown } from '../../components/ListDropdown';
import socketService from '../../services/socket';
import { storage } from '../../services/storage';

export default function ListsScreen() {
  const dispatch = useAppDispatch();
  const { lists, loading: listsLoading } = useAppSelector((state) => state.lists);
  const auth = useAppSelector((state) => state.auth);
  const networkState = useAppSelector((state) => state.network);
  const { isDark } = useTheme();
  const [newListName, setNewListName] = useState('');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newItems, setNewItems] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const colors = useThemeColors();

  
  useEffect(() => {
	console.log("[ListsScreen] Auth token: ", auth.token);
    dispatch(fetchLists());
  }, [networkState.lastConnectionRestored]);

  // Handle list selection
  useEffect(() => {
    const loadSelectedList = async () => {
      const savedListId = await storage.getSelectedList();
      
      if (!lists?.length) {
        // No lists available, only clear selection if we currently have one
        if (selectedList) {
          setSelectedList(null);
          await storage.saveSelectedList(null);
        }
        return;
      }

      // Only proceed if we need to change the selection
      if (selectedList && lists.some(list => list._id === selectedList)) {
        return;
      }

      if (savedListId && lists.some((list: List) => list._id === savedListId)) {
        // Use saved list if it exists
        setSelectedList(savedListId);
      } else {
        // Auto-select first list if no valid saved list
        setSelectedList(lists[0]._id);
        await storage.saveSelectedList(lists[0]._id);
      }
    };
    
    loadSelectedList();

    // Cleanup on unmount
    return () => {
      if (selectedList) {
        socketService.leaveList(selectedList);
      }
    };
  }, [lists]); // Only depend on lists changing

  // Socket connection effect for selected list updates
  useEffect(() => {
    if (!selectedList) return;

    socketService.joinList(selectedList);

    // Listen for real-time updates
    if (socketService.socket) {
      const onListUpdated = () => {
        // Refresh lists to get the latest data
        dispatch(fetchLists());
      };

      socketService.socket.on('listUpdated', onListUpdated);

      // Cleanup: leave room and remove listeners
      return () => {
        socketService.socket?.off('listUpdated', onListUpdated);
        socketService.leaveList(selectedList);
      };
    }
  }, [selectedList]);

  // Socket connection effect for list creation and deletion
  useEffect(() => {
    if (!socketService.socket) return;

    const onListCreated = (data: any) => {
      dispatch(fetchLists());
    };

    const onListDeleted = (data: any) => {
      if (data.listId === selectedList) {
        setSelectedList(null);
        storage.saveSelectedList(null);
      }
      dispatch(fetchLists());
    };

    socketService.socket.on('listCreated', onListCreated);
    socketService.socket.on('listDeleted', onListDeleted);

    // Cleanup: remove listeners
    return () => {
      socketService.socket?.off('listCreated', onListCreated);
      socketService.socket?.off('listDeleted', onListDeleted);
    };
  }, []);

  const handleListPress = async (listId: string) => {
    if (selectedList) {
      socketService.leaveList(selectedList);
    }
    
    setSelectedList(listId);
    setIsDropdownOpen(false);
    await storage.saveSelectedList(listId);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      const result = await dispatch(createList({ title: newListName })).unwrap();
      setNewListName('');
      // Automatically select the newly created list
      if (result._id) {
        handleListPress(result._id);
      }
    } catch (error) {
      console.error('Failed to create list:', error);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    if (!selectedList || !selectedListData) {
      console.log('[ListsScreen] Cannot toggle item: no selected list or list data', {
        selectedList,
        hasListData: !!selectedListData
      });
      return;
    }

    try {
      const item = selectedListData.items.find(item => item._id === itemId);
      
      if (!item) {
        console.log('[ListsScreen] Item not found in list:', {
          itemId,
          listId: selectedList
        });
        return;
      }

      await dispatch(updateListItem({
        listId: selectedList,
        itemId: itemId,
        updates: { completed: !item.completed }
      })).unwrap();
      
    } catch (error) {
      console.error('[ListsScreen] Failed to toggle item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedList) return;

    try {
      await dispatch(deleteListItem({
        listId: selectedList,
        itemId: itemId
      })).unwrap();
    } catch (error) {
      console.error('[ListsScreen] Failed to delete item:', error);
    }
  };

  const handleEditItem = async (itemId: string, newText: string) => {
    if (!selectedList) return;

    try {
      await dispatch(updateListItem({
        listId: selectedList,
        itemId: itemId,
        updates: { text: newText }
      })).unwrap();
    } catch (error) {
      console.error('[ListsScreen] Failed to update item:', error);
    }
  };

  const selectedListData = lists?.find((list: List) => list._id === selectedList);

  const getCompletedCount = (list: List) => {
    return list.items.filter(item => item.completed).length;
  };

  const handleAddItems = async () => {
    if (!newItems.trim() || !selectedList) return;

    // Split items by commas or new lines
    const items = newItems
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(text => ({
        text,
        completed: false
      }));

    if (items.length === 0) return;

    try {
      await dispatch(addListItems({
        listId: selectedList,
        items
      })).unwrap();
      setNewItems('');
    } catch (error) {
      console.error('[ListsScreen] Failed to add items:', error);
    }
  };

  const handleDeleteList = (listId: string) => {
    setListToDelete(listId);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (listToDelete) {
      try {
        // Find the next list before deletion
        const nextList = lists.find((list: List) => list._id !== listToDelete);
        if (nextList) {
          // Update selected list before deletion
          setSelectedList(nextList._id);
          await storage.saveSelectedList(nextList._id);
        }

        setShowDeleteConfirmation(false);
        await dispatch(deleteList(listToDelete)).unwrap();
        setListToDelete(null);
      } catch (error) {
        console.error('Failed to delete list:', error);
      }
    }
  };

  const handleEditList = () => {
    if (!selectedListData) return;
    setEditedTitle(selectedListData.title);
    setIsEditingTitle(true);
  };

  const handleUpdateTitle = async () => {
    if (!selectedList || !editedTitle.trim()) return;
    
    // Only update if the title has changed
    if (editedTitle.trim() !== selectedListData?.title) {
      try {
        await dispatch(updateList({ 
          listId: selectedList,
          data: { title: editedTitle.trim() }
        })).unwrap();
      } catch (error) {
        console.error('Failed to update title:', error);
      }
    }
    
    setIsEditingTitle(false);
  };

  const handleShareList = () => {
    setIsShareModalVisible(true);
  };

  if (listsLoading && !lists) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent
      />
      <AppHeader />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* My Lists Section with Dropdown */}
        <View style={styles.myListsSection}>
          <ListDropdown
            lists={lists}
            selectedList={selectedList}
            onListPress={handleListPress}
            isDropdownOpen={isDropdownOpen}
            onDropdownToggle={() => setIsDropdownOpen(!isDropdownOpen)}
          />
          
          {/* New List Creation Row */}
          <View style={styles.createListRow}>
            <TextInput
              style={[
                styles.createListInput,
                {
                  backgroundColor: colors.background,
                  color: colors.foreground,
                  borderColor: colors.border
                }
              ]}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="New list name"
              placeholderTextColor={colors.mutedForeground}
            />
            <TouchableOpacity 
              style={[
                styles.createListButton,
                { backgroundColor: colors.primary },
                !newListName.trim() && { opacity: 0.5 }
              ]}
              onPress={handleCreateList}
              disabled={!newListName.trim()}
            >
              <Text style={[styles.createListButtonText, { color: colors.primaryForeground }]}>
                Create List
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected List Card */}
        {selectedListData && (
          <View style={[
            styles.selectedListCard, 
            { 
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1
            }
          ]}>
            <View style={styles.selectedListHeader}>
              <View style={styles.selectedListTitleSection}>
                {isEditingTitle ? (
                  <View style={styles.editTitleSection}>
                    <TextInput
                      style={[
                        styles.editTitleInput,
                        {
                          color: colors.foreground,
                          borderColor: colors.border,
                          backgroundColor: colors.background
                        }
                      ]}
                      value={editedTitle}
                      onChangeText={setEditedTitle}
                      onSubmitEditing={handleUpdateTitle}
                      onBlur={() => {
                        if (editedTitle === selectedListData?.title) {
                          setIsEditingTitle(false);
                        }
                      }}
                      autoFocus
                    />
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.outlineButton]} 
                      onPress={handleUpdateTitle}
                    >
                      <Save size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.outlineButton]} 
                      onPress={() => {
                        setEditedTitle(selectedListData?.title || '');
                        setIsEditingTitle(false);
                      }}
                    >
                      <X size={18} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.titleAndCount}>
                      <Text style={[styles.selectedListTitle, { color: colors.foreground }]}>
                        {selectedListData.title}
                      </Text>
                      <Text style={[styles.itemCount, { color: colors.mutedForeground }]}>
                        ({getCompletedCount(selectedListData)}/{selectedListData.items.length})
                      </Text>
                    </View>
                    <View style={styles.selectedListActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={handleEditList}
                      >
                        <Pencil size={18} color={colors.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.outlineButton]}
                        onPress={handleShareList}
                      >
                        <Share2 size={18} color={colors.foreground} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[
                          styles.actionButton,
                          styles.deleteButton,
                          { backgroundColor: colors.destructive }
                        ]}
                        onPress={() => handleDeleteList(selectedListData._id)}
                      >
                        <Trash2 size={20} color={colors.destructiveForeground} />
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Add Item Section */}
            <View style={styles.addItemSection}>
              <View style={styles.addItemContainer}>
                <TextInput
                  style={[
                    styles.addItemInput,
                    {
                      backgroundColor: colors.accent,
                      color: colors.foreground,
                      borderColor: colors.border
                    }
                  ]}
                  value={newItems}
                  onChangeText={setNewItems}
                  placeholder="Add items (separate with commas or new lines)"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                />
                <TouchableOpacity 
                  style={[
                    styles.addItemButton,
                    { backgroundColor: colors.primary },
                    !newItems.trim() && { opacity: 0.5 }
                  ]}
                  onPress={handleAddItems}
                  disabled={!newItems.trim()}
                >
                  <Text style={[styles.addItemButtonText, { color: colors.primaryForeground }]}>
                    Add Item
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selected List Items */}
            <View style={styles.listItemsSection}>
              {selectedListData && selectedListData.items.length > 0 && (
                <DraggableList
                  items={selectedListData.items}
                  onToggle={handleToggleItem}
                  onDelete={handleDeleteItem}
                  onEdit={handleEditItem}
                />
              )}
            </View>
          </View>
        )}

        {/* Modals */}
        {isShareModalVisible && (
          <ShareListModal
            listId={selectedList || ''}
            visible={isShareModalVisible}
            onClose={() => setIsShareModalVisible(false)}
          />
        )}
        <ConfirmationModal
          visible={showDeleteConfirmation}
          title="Delete List"
          message="Are you sure you want to delete this list? This action cannot be undone. This will permanently delete your list and all its items."
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteConfirmation(false);
            setListToDelete(null);
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    marginTop: 80,
  },
  scrollContent: {
    paddingTop: theme.spacing.m,
  },
  myListsSection: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
  },
  createListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
    gap: theme.spacing.m,
  },
  createListInput: {
    flex: 1,
    height: 40,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.s,
    fontSize: 16,
    borderWidth: 1,
  },
  createListButton: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createListButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedListCard: {
    borderRadius: theme.borderRadius.m,
    marginHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    padding: theme.spacing.m,
    ...theme.shadows.small,
  },
  selectedListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  selectedListTitleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleAndCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  selectedListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemCount: {
    fontSize: 14,
  },
  selectedListActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.m,
  },
  actionButton: {
    padding: theme.spacing.s,
    marginLeft: theme.spacing.s,
  },
  addItemSection: {
    marginTop: theme.spacing.s,
  },
  addItemContainer: {
    flexDirection: 'column',
    gap: theme.spacing.s,
  },
  addItemInput: {
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    borderWidth: 1,
  },
  addItemButton: {
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.s,
    height: 40,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editTitleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
  },
  editTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
  },
  outlineButton: theme.buttons.outline,
  deleteButton: theme.buttons.destructive,
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItemsSection: {
    flex: 1,
    marginTop: theme.spacing.l,
  },
}); 