import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, TextInput, ScrollView, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { ListItem } from '../../components/ListItem';
import { ShareListModal } from '../../components/ShareListModal';
import { BellOff, Sun, User, ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Share2, Trash2, Save, X } from 'lucide-react-native';
import { theme } from '../../constants/theme';
import { ListStackScreenProps } from '../../navigation/types';
import { fetchLists, createList, updateListItem, deleteListItem, updateList, deleteList, shareList } from '../../store/actions/listActions';
import { List } from '../../store/slices/listSlice';
import { DraggableList } from '../../components/DraggableList';
import { AppHeader } from '../../components/AppHeader';
import { ConfirmationModal } from '../../components/ConfirmationModal';

export default function ListsScreen() {
  const navigation = useNavigation<ListStackScreenProps<'ListsHome'>['navigation']>();
  const dispatch = useAppDispatch();
  const { lists, loading: listsLoading } = useAppSelector((state) => state.lists);
  const [newListName, setNewListName] = useState('');
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newItems, setNewItems] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [listToDelete, setListToDelete] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchLists());
  }, [dispatch]);

  useEffect(() => {
    if (lists?.length > 0 && !selectedList) {
      setSelectedList(lists[0]._id);
    }
  }, [lists]);

  const handleListPress = (listId: string) => {
    setSelectedList(listId);
    setIsDropdownOpen(false);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await dispatch(createList({ title: newListName }));
      setNewListName('');
    } catch (error) {
      // Error is handled by the action
    }
  };

  const handleToggleItem = async (itemId: string) => {
    if (!selectedList || !selectedListData) return;

    const updatedItems = selectedListData.items.map(item => 
      item._id === itemId ? { ...item, completed: !item.completed } : item
    );

    try {
      await dispatch(updateList(selectedList, { items: updatedItems }));
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedList || !selectedListData) return;

    const updatedItems = selectedListData.items.filter(item => item._id !== itemId);

    try {
      await dispatch(updateList(selectedList, { items: updatedItems }));
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const handleEditItem = async (itemId: string, newText: string) => {
    if (!selectedList || !selectedListData) return;

    const updatedItems = selectedListData.items.map(item => 
      item._id === itemId ? { ...item, text: newText } : item
    );

    try {
      await dispatch(updateList(selectedList, { items: updatedItems }));
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const selectedListData = lists?.find(list => list._id === selectedList);

  const getCompletedCount = (list: List) => {
    return list.items.filter(item => item.completed).length;
  };

  const handleAddItems = async () => {
    if (!newItems.trim() || !selectedList || !selectedListData) return;

    // Split items by commas or new lines
    const items = newItems
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);

    if (items.length === 0) return;

    try {
      // Add all items at once
      const newItems = items.map(itemText => ({
        text: itemText,
        completed: false
      }));

      const updatedItems = [...selectedListData.items, ...newItems];
      await dispatch(updateList(selectedList, { items: updatedItems }));
      setNewItems('');
    } catch (error) {
      console.error('Failed to add items:', error);
    }
  };

  const handleDeleteList = (listId: string) => {
    setListToDelete(listId);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (listToDelete) {
      await dispatch(deleteList(listToDelete));
      setShowDeleteConfirmation(false);
      setListToDelete(null);
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
        await dispatch(updateList(selectedList, { title: editedTitle.trim() }));
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* My Lists Section with Dropdown */}
        <View style={styles.myListsSection}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>My Lists</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <Text style={styles.dropdownButtonText}>
                {selectedListData ? selectedListData.title : 'Select a list'}
              </Text>
              {isDropdownOpen ? (
                <ChevronsUpDown size={18} color={theme.colors.textY50} />
              ) : (
                <ChevronsUpDown size={18} color={theme.colors.textY50} />
              )}
            </TouchableOpacity>
          </View>

          {/* New List Creation Row */}
          <View style={styles.createListRow}>
            <TextInput
              style={styles.createListInput}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="New list name"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TouchableOpacity 
              style={[
                styles.createListButton,
                !newListName.trim() && styles.createListButtonDisabled
              ]}
              onPress={handleCreateList}
              disabled={!newListName.trim()}
            >
              <Text style={styles.createListButtonText}>Create List</Text>
            </TouchableOpacity>
          </View>
          
          {isDropdownOpen && lists && lists.length > 0 && (
            <View style={styles.dropdownList}>
              {lists.map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={[
                    styles.dropdownItem,
                    selectedList === item._id && styles.dropdownItemSelected
                  ]}
                  onPress={() => handleListPress(item._id)}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    selectedList === item._id && styles.dropdownItemTextSelected
                  ]}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Selected List Card */}
        {selectedListData && (
          <View style={styles.selectedListCard}>
            <View style={styles.selectedListHeader}>
              <View style={styles.selectedListTitleSection}>
                {isEditingTitle ? (
                  <View style={styles.editTitleSection}>
                    <TextInput
                      style={styles.editTitleInput}
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
                      <Save size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.outlineButton]} 
                      onPress={() => {
                        setEditedTitle(selectedListData?.title || '');
                        setIsEditingTitle(false);
                      }}
                    >
                      <X size={18} color={theme.colors.text} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.titleAndCount}>
                      <Text style={styles.selectedListTitle}>
                        {selectedListData.title}
                      </Text>
                      <Text style={styles.itemCount}>
                        ({getCompletedCount(selectedListData)}/{selectedListData.items.length})
                      </Text>
                    </View>
                    <View style={styles.selectedListActions}>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={handleEditList}
                      >
                        <Pencil size={18} color={theme.colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.outlineButton]}
                        onPress={handleShareList}
                      >
                        <Share2 size={18} color={theme.colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleDeleteList(selectedListData._id)}
                      >
                        <Trash2 size={20} color="#FFFFFF" />
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
                  style={styles.addItemInput}
                  value={newItems}
                  onChangeText={setNewItems}
                  placeholder="Add items (separate with commas or new lines)"
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                />
                <TouchableOpacity 
                  style={[
                    styles.addItemButton,
                    !newItems.trim() && styles.addItemButtonDisabled
                  ]}
                  onPress={handleAddItems}
                  disabled={!newItems.trim()}
                >
                  <Text style={styles.addItemButtonText}>Add Item</Text>
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

        {/* Share Modal */}
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
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    marginTop: 80, // Adjust this value based on your header height
  },
  scrollContent: {
    paddingTop: theme.spacing.m,
  },
  myListsSection: {
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.m,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#000000',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
    flex: 1,
    marginLeft: theme.spacing.m,
    maxWidth: '60%',
	borderWidth: 1,
	borderColor: '#e2e8f0',
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.m,
    marginTop: theme.spacing.s,
    ...theme.shadows.small,
    position: 'absolute',
    top: '100%',
    right: theme.spacing.m,
    left: '40%',
    zIndex: 1000,
  },
  dropdownItem: {
    padding: theme.spacing.s,
    borderBottomWidth: 1,
    boxShadow: 'none',
    borderBottomColor: '#e2e8f0',
  },
  dropdownItemSelected: {
    backgroundColor: theme.colors.surface,
  },
  dropdownItemText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  dropdownItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  createListSection: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.m,
    paddingBottom: theme.spacing.m,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    marginRight: theme.spacing.m,
    color: '#000000',
    fontSize: 16,
    ...theme.shadows.small,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemsSection: {
    flex: 1,
	marginTop: theme.spacing.l,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedListCard: {
    backgroundColor: '#FFFFFF',
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
    color: theme.colors.text,
  },
  itemCount: {
    fontSize: 14,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    minHeight: 100,
    textAlignVertical: 'top',
    color: theme.colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addItemButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.s,
    height: 40,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addItemButtonDisabled: {
    opacity: 0.5,
    backgroundColor: theme.colors.primary,
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
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
  },
  editTitleButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
  },
  editTitleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.s,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  createListButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createListButtonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  createListButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: theme.buttons.outline,
  deleteButton: theme.buttons.destructive,
}); 