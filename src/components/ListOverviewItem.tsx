import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { List } from '../store/slices/listSlice';
import { theme } from '../constants/theme';
import { useThemeColors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface ListOverviewItemProps {
  list: List;
  onPress: () => void;
}

export function ListOverviewItem({ list, onPress }: ListOverviewItemProps) {
  const completedItems = list.items.filter(item => item.completed).length;
  const totalItems = list.items.length;
  const colors = useThemeColors();

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: colors.card }]} 
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {list.title}
          </Text>
          {list.shared && (
            <Text style={[styles.sharedBadge, { color: colors.mutedForeground }]}>
              (Shared)
            </Text>
          )}
        </View>
        <View style={styles.countContainer}>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            ({completedItems}/{totalItems})
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    ...theme.shadows.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: theme.spacing.s,
  },
  sharedBadge: {
    fontSize: 14,
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  count: {
    fontSize: 14,
    marginRight: theme.spacing.s,
  },
}); 