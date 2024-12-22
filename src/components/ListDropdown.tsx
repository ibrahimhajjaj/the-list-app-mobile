import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import { List } from '../store/slices/listSlice';
import { ChevronsUpDown, Check } from 'lucide-react-native';
import { useAppSelector } from '../hooks/redux';

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
  const { user } = useAppSelector((state) => state.auth);
  const selectedListData = lists.find(list => list._id === selectedList);
  const colors = useThemeColors();
  
  // Filter lists based on search query
  const filteredLists = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return lists;
    return lists.filter(list => 
      list.title.toLowerCase().includes(query)
    );
  }, [lists, searchQuery]);

  // Separate lists into owned and shared
  const { ownedLists, sharedLists } = React.useMemo(() => {
    return filteredLists.reduce((acc, list) => {
      if (list.owner._id === user?._id) {
        acc.ownedLists.push(list);
      } else if (list.sharedWith.some(share => share.user === user?._id)) {
        acc.sharedLists.push(list);
      }
      return acc;
    }, { ownedLists: [] as List[], sharedLists: [] as List[] });
  }, [filteredLists, user?._id]);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          My Lists
        </Text>
        <TouchableOpacity 
          style={[
            styles.dropdownButton,
            {
              backgroundColor: colors.background,
              borderColor: colors.border
            }
          ]}
          onPress={onDropdownToggle}
        >
          <Text style={[styles.dropdownButtonText, { color: colors.foreground }]}>
            {selectedListData ? selectedListData.title : 'Select a list'}
          </Text>
          <ChevronsUpDown size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {isDropdownOpen && (
        <View style={[
          styles.dropdownContainer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border
          }
        ]}>
          <View style={[
            styles.searchContainer,
            { borderBottomColor: colors.border }
          ]}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.accent,
                  color: colors.foreground
                }
              ]}
              placeholder="Search list..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Owned Lists Section */}
          {ownedLists.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[
                styles.listSectionTitle,
                {
                  color: colors.mutedForeground,
                  backgroundColor: colors.background
                }
              ]}>
                Owned
              </Text>
              {ownedLists.map((list) => (
                <TouchableOpacity
                  key={list._id}
                  style={[
                    styles.listItem,
                    selectedList === list._id && {
                      backgroundColor: colors.accent
                    }
                  ]}
                  onPress={() => onListPress(list._id)}
                >
                  <View style={styles.listItemContent}>
                    <Text style={[
                      styles.listItemText,
                      { color: colors.foreground },
                      selectedList === list._id && {
                        color: colors.primary,
                        fontWeight: '600'
                      }
                    ]}>
                      {list.title}
                    </Text>
                    {selectedList === list._id && (
                      <Check size={16} color={colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Shared Lists Section */}
          {sharedLists.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[
                styles.listSectionTitle,
                {
                  color: colors.mutedForeground,
                  backgroundColor: colors.background
                }
              ]}>
                Shared with me
              </Text>
              {sharedLists.map((list) => (
                <TouchableOpacity
                  key={list._id}
                  style={[
                    styles.listItem,
                    selectedList === list._id && {
                      backgroundColor: colors.accent
                    }
                  ]}
                  onPress={() => onListPress(list._id)}
                >
                  <View style={styles.listItemContent}>
                    <Text style={[
                      styles.listItemText,
                      { color: colors.foreground },
                      selectedList === list._id && {
                        color: colors.primary,
                        fontWeight: '600'
                      }
                    ]}>
                      {list.title}
                    </Text>
                    {selectedList === list._id && (
                      <Check size={16} color={colors.primary} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {searchQuery && filteredLists.length === 0 && (
            <View style={styles.noResults}>
              <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                No lists found
              </Text>
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
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.s,
    borderRadius: theme.borderRadius.m,
    flex: 1,
    marginLeft: theme.spacing.m,
    maxWidth: '60%',
    borderWidth: 1,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '85%',
    right: 0,
    left: '40%',
    borderRadius: theme.borderRadius.m,
    borderWidth: 1,
    zIndex: 1000,
    ...theme.shadows.md,
  },
  searchContainer: {
    padding: theme.spacing.s,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.xs,
    fontSize: 14,
  },
  listSection: {
    paddingVertical: theme.spacing.s,
  },
  listSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.s,
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
  listItemText: {
    fontSize: 14,
    flex: 1,
  },
  noResults: {
    padding: theme.spacing.m,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
  },
}); 