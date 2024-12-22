import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { List } from '../store/slices/listSlice';
import { ChevronsUpDown, Check } from 'lucide-react-native';

interface ListDropdownProps {
  lists: List[];
  selectedList: string | null;
  onListPress: (listId: string) => void;
  isDropdownOpen: boolean;
  onDropdownToggle: () => void;
}

export function ListDropdown({ 
  lists, 
  selectedList, 
  onListPress,
  isDropdownOpen,
  onDropdownToggle
}: ListDropdownProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const selectedListData = lists.find(list => list._id === selectedList);
  
  // Filter lists based on search query
  const filteredLists = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return lists;
    return lists.filter(list => 
      list.title.toLowerCase().includes(query)
    );
  }, [lists, searchQuery]);

  const sharedLists = filteredLists.filter(list => list.shared);
  const ownedLists = filteredLists.filter(list => !list.shared);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Test</Text>
        <TouchableOpacity 
          style={styles.dropdownButton}
          onPress={onDropdownToggle}
        >
          <Text style={styles.dropdownButtonText}>
            {selectedListData ? selectedListData.title : 'Select a list'}
          </Text>
          <ChevronsUpDown size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {isDropdownOpen && (
        <View style={styles.dropdownContainer}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search list..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {sharedLists.length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>Shared</Text>
              {sharedLists.map((list) => (
                <TouchableOpacity
                  key={list._id}
                  style={[
                    styles.listItem,
                    selectedList === list._id && styles.listItemSelected
                  ]}
                  onPress={() => onListPress(list._id)}
                >
                  <View style={styles.listItemContent}>
                    <Text style={[
                      styles.listItemText,
                      selectedList === list._id && styles.listItemTextSelected
                    ]}>
                      {list.title} 🥬🥖🍄
                    </Text>
                    {selectedList === list._id && (
                      <Check size={16} color={theme.colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.listSection}>
            <Text style={styles.listSectionTitle}>Owned</Text>
            {ownedLists.map((list) => (
              <TouchableOpacity
                key={list._id}
                style={[
                  styles.listItem,
                  selectedList === list._id && styles.listItemSelected
                ]}
                onPress={() => onListPress(list._id)}
              >
                <View style={styles.listItemContent}>
                  <Text style={[
                    styles.listItemText,
                    selectedList === list._id && styles.listItemTextSelected
                  ]}>
                    {list.title}
                  </Text>
                  {selectedList === list._id && (
                    <Check size={16} color={theme.colors.primary} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {searchQuery && filteredLists.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No lists found</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
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
  dropdownContainer: {
    position: 'absolute',
    top: '85%',
    right: 0,
    left: '40%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 1000,
    ...theme.shadows.md,
  },
  searchContainer: {
    padding: theme.spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.xs,
    fontSize: 14,
    color: theme.colors.text,
  },
  listSection: {
    paddingVertical: theme.spacing.s,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.xs,
	marginBottom: theme.spacing.s,
    backgroundColor: theme.colors.background,
  },
  listItem: {
    paddingHorizontal: theme.spacing.m,
	paddingVertical: theme.spacing.s,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemSelected: {
    backgroundColor: theme.colors.accent,
  },
  listItemText: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  },
  listItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  noResults: {
    padding: theme.spacing.m,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
}); 