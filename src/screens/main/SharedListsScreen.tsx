import React, { useMemo } from 'react';
import { View, StyleSheet, FlatList, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ListItem } from '../../components/ListItem';
import { useNavigation } from '@react-navigation/native';
import { ListStackScreenProps } from '../../navigation/types';
import { theme } from '../../constants/theme';

const SharedListsScreen: React.FC = () => {
  const navigation = useNavigation<ListStackScreenProps<'ListsHome'>['navigation']>();
  const lists = useSelector((state: RootState) => state.lists.lists);
  
  const sharedLists = useMemo(() => 
    lists.filter(list => list.sharedWith.length > 0),
    [lists]
  );

  const handleListPress = (listId: string) => {
    navigation.navigate('ListDetail', { 
      listId,
      title: lists.find(list => list._id === listId)?.title || ''
    });
  };

  if (sharedLists.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No shared lists yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sharedLists}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <ListItem
            list={item}
            onPress={() => handleListPress(item._id)}
          />
        )}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContainer: {
    padding: theme.spacing.m,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});

export default SharedListsScreen; 