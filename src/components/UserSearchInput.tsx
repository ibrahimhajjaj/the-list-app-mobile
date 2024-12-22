import React, { useState, useCallback } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { debounce } from 'lodash';
import api from '../services/api';
import { useAppDispatch } from '../hooks/redux';
import { setError } from '../store/slices/listSlice';
import { theme } from '../constants/theme';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Props {
  onSelectUser: (user: User) => void;
  excludeUsers?: string[];
}

export const UserSearchInput: React.FC<Props> = ({ onSelectUser, excludeUsers = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();

  const searchUsers = useCallback(
    debounce(async (term: string) => {
      if (!term) {
        setUsers([]);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/users/search?q=${term}`);
        const filteredUsers = response.data.filter(
          (user: User) => !excludeUsers.includes(user._id)
        );
        setUsers(filteredUsers);
      } catch (error: any) {
        dispatch(setError(error.response?.data?.message || 'Failed to search users'));
      } finally {
        setLoading(false);
      }
    }, 300),
    [excludeUsers]
  );

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    searchUsers(text);
  };

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    setSearchTerm('');
    setUsers([]);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={searchTerm}
        onChangeText={handleSearch}
        placeholder="Search users by name or email"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading && <Text style={styles.loadingText}>Searching...</Text>}
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() => handleSelectUser(item)}
          >
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </TouchableOpacity>
        )}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.colors.background,
  },
  list: {
    maxHeight: 200,
  },
  userItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  loadingText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginVertical: 8,
  },
}); 