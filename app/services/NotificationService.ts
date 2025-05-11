import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if this notification needs personalization
    if (notification.request.content.data?.needsPersonalization) {
      try {
        // Get the user's name
        const userName = await getUserName();
        if (userName) {
          // Modify the notification content to include the username
          const baseMessage = notification.request.content.body;
          notification.request.content.body = `Hey ${userName}, ${baseMessage}`;
        }
      } catch (error) {
        console.error('Error personalizing notification:', error);
      }
    }
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

// Daily reminder messages by day of week
const dailyMessages = {
  1: "Starting fresh feels good — maybe it's time to check in with your tasks and your journal?", // Monday
  2: "Little steps make big moves — have you had a moment to touch your tasks and your journal today?", // Tuesday
  3: "In the middle of it all, a small pause can do wonders — maybe revisit your tasks and your journal?", // Wednesday
  4: "Steady rhythms lead to beautiful results — have you found a moment for your tasks and your journal?", // Thursday
  5: "The week's story is almost written — have you left a mark in your tasks and your journal?", // Friday
  6: "No rush, just a thought — maybe your tasks and your journal are waiting for you?", // Saturday
  0: "A quiet moment to look back — have you visited your tasks and your journal today?", // Sunday (0)
};

// Notification IDs for easy reference
export const NOTIFICATION_IDS = {
  AFTERNOON_REMINDER: 'afternoon-reminder',
  EVENING_REMINDER: 'evening-reminder',
};

/**
 * Request notification permissions
 * @returns Promise resolving to permission status
 */
export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Only ask if permissions have not been determined
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Save the permission status
  await AsyncStorage.setItem('notificationPermissionStatus', finalStatus);
  return finalStatus;
}

/**
 * Get the user's name from Firestore, AsyncStorage, or Firebase Auth
 */
async function getUserName(): Promise<string> {
  try {
    // Try to get from AsyncStorage first for performance
    const cachedName = await AsyncStorage.getItem('username');
    if (cachedName) return cachedName;
    
    // If not in AsyncStorage, try to get from Firestore
    const user = FIREBASE_AUTH.currentUser;
    if (!user) return '';
    
    try {
      // This is the same approach used in Sidebar.tsx
      const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Try username first, then fullName, then displayName
        const name = userData.username || userData.fullName || user.displayName || '';
        
        // Cache for future use
        if (name) {
          await AsyncStorage.setItem('username', name);
          return name;
        }
      }
    } catch (firestoreError) {
      console.log('Firestore error, falling back to Auth:', firestoreError);
      // If Firestore fails, continue to Auth fallback
    }
    
    // Fallback to Firebase Auth display name
    if (user.displayName) {
      const name = user.displayName.split(' ')[0];
      await AsyncStorage.setItem('username', name);
      return name;
    }
    
    return '';
  } catch (error) {
    console.error('Error getting user name:', error);
    return '';
  }
}

/**
 * Get the appropriate message based on the day of the week
 */
async function getDailyMessage() {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const baseMessage = dailyMessages[dayOfWeek as keyof typeof dailyMessages];
  
  // Try to get the user's name
  const userName = await getUserName();
  
  // If we have a user name, include it in the message
  if (userName) {
    return `Hey ${userName}, ${baseMessage}`;
  }
  
  // Otherwise return the base message
  return baseMessage;
}

/**
 * Schedule twice-daily reminders (2 PM and 7 PM)
 */
export async function scheduleDailyReminders() {
  try {
    // First, cancel any existing reminders
    await cancelAllScheduledNotifications();

    // Check if notifications are enabled
    const notificationsEnabled = await AsyncStorage.getItem('notifications');
    if (notificationsEnabled === 'false') {
      console.log('Notifications are disabled. Not scheduling reminders.');
      return;
    }

    // Get permission status
    const permissionStatus = await requestNotificationPermissions();
    if (permissionStatus !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Calculate seconds until next 2 PM
    const now = new Date();
    const nextAfternoon = new Date(now);
    nextAfternoon.setHours(14, 0, 0, 0);
    if (now >= nextAfternoon) {
      // If it's already past 2 PM, schedule for tomorrow
      nextAfternoon.setDate(nextAfternoon.getDate() + 1);
    }
    const secondsUntilAfternoon = Math.floor((nextAfternoon.getTime() - now.getTime()) / 1000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DailyX Reminder',
        body: dailyMessages[nextAfternoon.getDay() as keyof typeof dailyMessages],
        data: {
          screen: 'Dashboard',
          needsPersonalization: true
        },
      },
      trigger: {
        seconds: secondsUntilAfternoon,
        repeats: true,
      },
      identifier: NOTIFICATION_IDS.AFTERNOON_REMINDER,
    });

    // Calculate seconds until next 7 PM
    const nextEvening = new Date(now);
    nextEvening.setHours(19, 0, 0, 0);
    if (now >= nextEvening) {
      nextEvening.setDate(nextEvening.getDate() + 1);
    }
    const secondsUntilEvening = Math.floor((nextEvening.getTime() - now.getTime()) / 1000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DailyX Evening Check-in',
        body: dailyMessages[nextEvening.getDay() as keyof typeof dailyMessages],
        data: {
          screen: 'Dashboard',
          needsPersonalization: true
        },
      },
      trigger: {
        seconds: secondsUntilEvening,
        repeats: true,
      },
      identifier: NOTIFICATION_IDS.EVENING_REMINDER,
    });

    // No immediate notification is sent here. Only scheduled notifications for 2 PM and 7 PM.
    // This logic ensures that enabling notifications after the scheduled time does NOT result in an instant notification.

    console.log('Daily reminders scheduled successfully');
  } catch (error) {
    console.error('Error scheduling reminders:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All scheduled notifications canceled');
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

/**
 * Toggle notifications on/off
 * @param enabled Whether notifications should be enabled
 */
export async function toggleNotifications(enabled: boolean) {
  try {
    if (enabled) {
      await scheduleDailyReminders();
    } else {
      await cancelAllScheduledNotifications();
    }
    return true;
  } catch (error) {
    console.error('Error toggling notifications:', error);
    return false;
  }
}

/**
 * Initialize notifications when app starts
 */
export async function initializeNotifications() {
  const notificationsEnabled = await AsyncStorage.getItem('notifications');
  if (notificationsEnabled !== 'false') {
    await scheduleDailyReminders();
  }
}
