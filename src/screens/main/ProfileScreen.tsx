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
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { updateUser, logout } from '../../store/slices/authSlice';
import { theme } from '../../constants/theme';
import { useThemeColors } from '../../constants/theme';
import { commonStyles } from '../../theme/commonStyles';
import { Bell, ChevronRight, LogOut, Settings, User, ArrowLeft } from 'lucide-react-native';
import { 
  toggleNotifications,
  toggleTitleChangeNotifications,
  toggleItemAddNotifications,
  toggleItemDeleteNotifications,
  toggleItemEditNotifications,
  toggleItemCompleteNotifications,
} from '../../store/slices/settingsSlice';
import { SafeAreaView } from 'react-native-safe-area-context';

interface NotificationSettingRowProps {
  title: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function NotificationSettingRow({ title, value, onToggle, disabled = false }: NotificationSettingRowProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.settingRow}>
      <Text style={[styles.settingText, { color: colors.foreground }]}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.muted, true: colors.primary }}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation();
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
  const colors = useThemeColors();

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
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar 
        barStyle={colors.card === 'hsl(222.2, 84%, 4.9%)' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
      </View>
      <ScrollView 
        style={[styles.scrollView, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
                {user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            {!isEditing && (
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {user?.name}
                </Text>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>
                  {user?.email}
                </Text>
              </View>
            )}
          </View>

          {isEditing ? (
            <View style={styles.form}>
              <TextInput
                style={[
                  commonStyles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border
                  }
                ]}
                placeholder="Name"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
              />
              <TextInput
                style={[
                  commonStyles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border
                  }
                ]}
                placeholder="Email"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border
                    }
                  ]}
                  onPress={() => setIsEditing(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.primary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    { backgroundColor: colors.primary }
                  ]}
                  onPress={handleUpdate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.editProfileButton, 
                  { 
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1
                  }
                ]}
                onPress={() => setIsEditing(true)}
              >
                <User size={20} color={colors.foreground} />
                <Text style={[styles.editProfileText, { color: colors.foreground }]}>
                  Edit Profile
                </Text>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <View style={[
                styles.section, 
                { 
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1
                }
              ]}>
                <View style={styles.sectionHeader}>
                  <Bell size={20} color={colors.foreground} />
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Notification Settings
                  </Text>
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
            style={[
              styles.logoutButton, 
              { 
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1
              }
            ]}
            onPress={handleLogout}
          >
            <LogOut size={20} color={colors.destructive} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: theme.spacing.m,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  userInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: 16,
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
    borderWidth: 1,
    marginHorizontal: theme.spacing.s,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.m,
    borderRadius: 12,
    marginBottom: theme.spacing.m,
    ...theme.shadows.small,
  },
  editProfileText: {
    flex: 1,
    marginLeft: theme.spacing.m,
    fontSize: 16,
  },
  section: {
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
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.m,
    borderRadius: 12,
    marginTop: 'auto',
    ...theme.shadows.small,
  },
  logoutText: {
    marginLeft: theme.spacing.m,
    fontSize: 16,
    fontWeight: '600',
  },
  headerContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  backButton: {
    padding: theme.spacing.s,
    marginRight: theme.spacing.s,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
}); 