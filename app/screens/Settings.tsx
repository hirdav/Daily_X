import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert, Linking, Platform } from 'react-native';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_AUTH } from '../../FirebaseConfig';
import { Typography, Spacing, GlobalStyles, Layout } from '../styles/global';
import Theme from '../styles/theme';
import { MaterialIcons } from '@expo/vector-icons';
import type { MaterialIcons as MaterialIconsType } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { toggleNotifications, requestNotificationPermissions } from '../services/NotificationService';
import NotificationSettings from '../components/NotificationSettings';

import EditProfile from '../components/EditProfile';
import ChangePassword from '../components/ChangePassword';
import FAQModal from '../components/FAQModal';

type IconName = keyof typeof MaterialIconsType.glyphMap;

type RootStackParamList = {
  Settings: undefined;
  Login: undefined;
};

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItemProps {
  icon: IconName;
  title: string;
  value?: boolean;
  onPress: () => void;
  isSwitch?: boolean;
}

const SUPPORT_BASE_URL = 'https://hirdav.github.io/dailyx-support';

const Settings = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { isDarkMode, toggleDarkMode, soundEnabled, toggleSound, playSound, colors } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(0); // Counter to trigger profile refresh

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const notifs = await AsyncStorage.getItem('notifications');
      setNotifications(notifs !== 'false');
    } catch (error) {
      // Logging removed for production
    }
  };

  const handleDarkMode = () => {
    toggleDarkMode();
    playSound('buttonPress');
  };

  const handleNotifications = async (value: boolean) => {
    try {
      if (value) {
        const permissionStatus = await requestNotificationPermissions();
        if (permissionStatus !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to receive reminders.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      await AsyncStorage.setItem('notifications', value ? 'true' : 'false');
      setNotifications(value);
      await toggleNotifications(value);
    } catch (error) {
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleSoundEffects = () => {
    toggleSound();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            FIREBASE_AUTH.signOut()
              .then(() => {
                navigation.navigate('Login');
              })
              .catch(error => {
                Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
              });
          }
        },
      ]
    );
  };

  const handleProfileUpdated = () => {
    setProfileUpdated(prev => prev + 1);
    playSound('buttonPress');
  };

  const openSupportPage = (page: string) => {
    Linking.openURL(`${SUPPORT_BASE_URL}/#${page}`).catch((err) => {
      Alert.alert('Error', 'Could not open the support page');
    });
  };

  const SettingItem: React.FC<SettingItemProps> = ({ icon, title, value, onPress, isSwitch = false }) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      disabled={isSwitch}
    >
      <View style={styles.settingLeft}>
        <MaterialIcons name={icon} size={24} color={Theme.Colors.primary} />
        <Text style={[Theme.Typography.body, { color: colors.text }]}>{title}</Text>
      </View>
      {isSwitch ? (
        <Switch
          value={value}
          onValueChange={onPress}
          trackColor={{ false: colors.border, true: Theme.Colors.primary }}
          thumbColor={colors.surface}
        />
      ) : (
        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: Spacing.medium,
    },
    section: {
      marginBottom: Spacing.large,
    },
    sectionTitle: {
      ...Typography.sectionTitle,
      marginBottom: Spacing.small,
    },
    sectionContent: {
      backgroundColor: Theme.Colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    notificationInfo: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 4,
      backgroundColor: Theme.Colors.surface,
    },
    notificationInfoText: {
      ...Typography.caption,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    versionContainer: {
      alignItems: 'center',
      marginVertical: Spacing.large,
    },
    versionText: {
      ...Typography.caption,
      color: Theme.Colors.textSecondary,
    },
    logoutButtonMain: {
      backgroundColor: Theme.Colors.error,
      borderRadius: 12,
      padding: Spacing.medium,
      alignItems: 'center',
      marginHorizontal: Spacing.medium,
      marginBottom: Spacing.xlarge,
    },
    logoutTextMain: {
      ...Typography.body,
      color: Theme.Colors.textLight,
      fontWeight: '500',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Theme.Spacing.md,
      paddingHorizontal: Theme.Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      borderRadius: Theme.Layout.radiusMd,
      marginHorizontal: Theme.Spacing.md,
      marginVertical: Theme.Spacing.xs,
      ...Theme.Shadows.small,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingText: {
      fontSize: 16,
      marginLeft: Theme.Spacing.md,
    },
    versionContainerMain: {
      alignItems: 'center',
      marginTop: Spacing.large,
      marginBottom: Spacing.medium,
    },
    versionTextMain: {
      ...Theme.Typography.caption,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={[Theme.ComponentStyles.container, { backgroundColor: colors.background }]}>
      <View style={[Theme.ComponentStyles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialIcons name="menu" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
        <Text style={Theme.ComponentStyles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Preferences Section */}
        <View style={[styles.section, { paddingHorizontal: Theme.Spacing.md }]}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Theme.Spacing.md, marginBottom: Theme.Spacing.sm }]}>Preferences</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="dark-mode"
              title=" Dark Mode"
              value={isDarkMode}
              onPress={() => handleDarkMode()}
              isSwitch
            />
            <SettingItem
              icon="notifications"
              title=" Notifications"
              value={notifications}
              onPress={() => handleNotifications(!notifications)}
              isSwitch
            />
            <SettingItem
              icon="volume-up"
              title=" Sound Effects"
              value={soundEnabled}
              onPress={() => handleSoundEffects()}
              isSwitch
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={[styles.section, { paddingHorizontal: Spacing.medium }]}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="person"
              title=" Edit Profile"
              onPress={() => setEditProfileVisible(true)}
            />
            <SettingItem
              icon="lock"
              title=" Change Password"
              onPress={() => setChangePasswordVisible(true)}
            />
          </View>
        </View>

        {/* Help & Support Section */}
        <View style={[styles.section, { paddingHorizontal: Spacing.medium }]}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="help-outline"
              title=" FAQ"
              onPress={() => setFaqModalVisible(true)}
            />
            <SettingItem
              icon="contact-support"
              title=" Contact Support & Feedback "
              onPress={() => openSupportPage('contact')}
            />
            <SettingItem
              icon="privacy-tip"
              title=" Privacy Policy"
              onPress={() => openSupportPage('privacy')}
            />
            <SettingItem
              icon="description"
              title=" About DailyX"
              onPress={() => Linking.openURL('https://hirdav.github.io/dailyx_Web/').catch(() => {
                Alert.alert('Error', 'Could not open the About page');
              })}
            />
          </View>
        </View>

        {/* Version Info */}
        <View style={styles.versionContainerMain}>
          <Text style={styles.versionTextMain}>DailyX v1.0.5</Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButtonMain}
          onPress={handleLogout}
        >
          <Text style={styles.logoutTextMain}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modals */}
      {editProfileVisible && (
        <EditProfile
          visible={editProfileVisible}
          onClose={() => setEditProfileVisible(false)}
        />
      )}
      <ChangePassword
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
      <FAQModal
        visible={faqModalVisible}
        onClose={() => setFaqModalVisible(false)}
      />
    </View>
  );
};

export default Settings;
