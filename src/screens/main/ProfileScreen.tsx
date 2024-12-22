import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateUser, logout } from '../../store/slices/authSlice';
import { theme } from '../../constants/theme';
import { commonStyles } from '../../theme/commonStyles';
import { Bell, ChevronRight, LogOut, Settings, User } from 'lucide-react-native';
import { 
  toggleNotifications,
  toggleTitleChangeNotifications,
  toggleItemAddNotifications,
  toggleItemDeleteNotifications,
  toggleItemEditNotifications,
  toggleItemCompleteNotifications,
} from '../../store/slices/settingsSlice';

interface NotificationSettingRowProps {
  title: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function NotificationSettingRow({ title, value, onToggle, disabled = false }: NotificationSettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingText}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: theme.colors.gray, true: theme.colors.primary }}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const { user, loading } = useAppSelector((state) => state.auth);
  const { 
    notificationsEnabled,
    titleChangeNotifications,
    itemAddNotifications,
    itemDeleteNotifications,
    itemEditNotifications,
    itemCompleteNotifications,
  } = useAppSelector((state) => state.settings);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  const handleUpdate = async () => {
    if (!name || !email) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }

    try {
      await dispatch(updateUser({ name, email })).unwrap();
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => dispatch(logout()) },
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView style={commonStyles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          {!isEditing && (
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          )}
        </View>

        {isEditing ? (
          <View style={styles.form}>
            <TextInput
              style={commonStyles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
            />
            <TextInput
              style={commonStyles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.surface} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => setIsEditing(true)}
            >
              <User size={20} color={theme.colors.text} />
              <Text style={styles.editProfileText}>Edit Profile</Text>
              <ChevronRight size={20} color={theme.colors.textLight} />
            </TouchableOpacity>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Bell size={20} color={theme.colors.text} />
                <Text style={styles.sectionTitle}>Notification Settings</Text>
              </View>
              
              <NotificationSettingRow
                title="Enable All Notifications"
                value={notificationsEnabled}
                onToggle={() => dispatch(toggleNotifications())}
              />
              <NotificationSettingRow
                title="List Title Changes"
                value={titleChangeNotifications}
                onToggle={() => dispatch(toggleTitleChangeNotifications())}
                disabled={!notificationsEnabled}
              />
              <NotificationSettingRow
                title="New Items Added"
                value={itemAddNotifications}
                onToggle={() => dispatch(toggleItemAddNotifications())}
                disabled={!notificationsEnabled}
              />
              <NotificationSettingRow
                title="Items Deleted"
                value={itemDeleteNotifications}
                onToggle={() => dispatch(toggleItemDeleteNotifications())}
                disabled={!notificationsEnabled}
              />
              <NotificationSettingRow
                title="Items Edited"
                value={itemEditNotifications}
                onToggle={() => dispatch(toggleItemEditNotifications())}
                disabled={!notificationsEnabled}
              />
              <NotificationSettingRow
                title="Items Completed/Uncompleted"
                value={itemCompleteNotifications}
                onToggle={() => dispatch(toggleItemCompleteNotifications())}
                disabled={!notificationsEnabled}
              />
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <LogOut size={20} color={theme.colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: theme.spacing.m,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  avatarText: {
    fontSize: 40,
    color: theme.colors.surface,
    fontWeight: 'bold',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: 16,
    color: theme.colors.textLight,
  },
  form: {
    marginBottom: theme.spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.m,
  },
  button: {
    flex: 1,
    padding: theme.spacing.m,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: theme.spacing.s,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  saveButton: {
    marginLeft: theme.spacing.s,
    backgroundColor: theme.colors.primary,
  },
  cancelButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    ...theme.shadows.small,
  },
  editProfileText: {
    flex: 1,
    marginLeft: theme.spacing.m,
    fontSize: 16,
    color: theme.colors.text,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    ...theme.shadows.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.m,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.s,
  },
  settingText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginTop: 'auto',
    ...theme.shadows.small,
  },
  logoutText: {
    marginLeft: theme.spacing.m,
    fontSize: 16,
    color: theme.colors.error,
    fontWeight: '600',
  },
}); 