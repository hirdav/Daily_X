import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { requestNotificationPermissions } from '../services/NotificationService';
import Theme from '../styles/theme';

interface NotificationSettingsProps {
  notifications: boolean;
  onToggle: (value: boolean) => void;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

// Daily reminder messages by day of week
const DAILY_MESSAGES = {
  'Monday': "Starting fresh feels good — maybe it's time to check in with your tasks and your journal?",
  'Tuesday': "Little steps make big moves — have you had a moment to touch your tasks and your journal today?",
  'Wednesday': "In the middle of it all, a small pause can do wonders — maybe revisit your tasks and your journal?",
  'Thursday': "Steady rhythms lead to beautiful results — have you found a moment for your tasks and your journal?",
  'Friday': "The week's story is almost written — have you left a mark in your tasks and your journal?",
  'Saturday': "No rush, just a thought — maybe your tasks and your journal are waiting for you?",
  'Sunday': "A quiet moment to look back — have you visited your tasks and your journal today?"
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ notifications, onToggle }) => {
  const { colors } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  useEffect(() => {
    // Load permission status on component mount
    const loadPermissionStatus = async () => {
      const status = await AsyncStorage.getItem('notificationPermissionStatus');
      setPermissionStatus(status);
    };
    
    loadPermissionStatus();
  }, []);

  const handleRequestPermissions = async () => {
    const status = await requestNotificationPermissions();
    setPermissionStatus(status);
    
    if (status === 'granted') {
      Alert.alert(
        'Permissions Granted',
        'You will now receive daily reminders at 2 PM and 7 PM.',
        [{ text: 'Great!' }]
      );
    }
  };

  return (
    <>
      {/* Main toggle that matches other setting items exactly */}
      <TouchableOpacity 
        style={[styles.settingItem, { backgroundColor: colors.surface }]} 
        onPress={() => onToggle(!notifications)}
        disabled={true}
      >
        <View style={styles.settingLeft}>
          <MaterialIcons name="notifications" size={24} color={Theme.Colors.primary} />
          <Text style={[styles.settingText, { color: colors.text }]}> Notifications</Text>
        </View>
        <Switch
          value={notifications}
          onValueChange={(value) => onToggle(value)}
          trackColor={{ false: colors.border, true: Theme.Colors.primary }}
          thumbColor={colors.surface}
        />
      </TouchableOpacity>
      
      {/* Separate info component that appears below the toggle */}
      {notifications && (
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            You'll receive gentle reminders at 2 PM and 7 PM daily with unique messages each day of the week.
          </Text>
          
          {permissionStatus !== 'granted' && (
            <TouchableOpacity 
              style={[styles.permissionButton, { backgroundColor: Theme.Colors.primary }]} 
              onPress={handleRequestPermissions}
            >
              <Text style={[styles.permissionButtonText, { color: Theme.Colors.textLight }]}>
                Grant Notification Permissions
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  permissionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NotificationSettings;
