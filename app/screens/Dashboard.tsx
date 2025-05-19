import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
// Import Firestore functions separately to avoid any potential issues
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  Timestamp,
  writeBatch,
  increment,
  onSnapshot,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToTasks, Task as TaskType, completeTask, updateTask, subscribeToUserStats, resetRecurringTasks, SubTask, togglePinnedTask } from '../utils/firebaseService';
import { formatDateString } from '../utils/dateUtils';
import { Colors, Typography, Spacing } from '../styles/global';
import Theme from '../styles/theme';
import XPBankManager from '../components/XPBankManager';
import { useNavigation, DrawerActions } from '@react-navigation/native';
// Stats service no longer needed

interface Stats {
  totalTasks: number;
  completedTasks: number;
  completedCount?: number; // Added for backward compatibility
  totalXP: number;
  todayXP: number;
  xpProgress: number; // Percentage of daily XP earned (0-100)
}

// Use the Task interface with subtasks
interface Task extends TaskType {}

const Dashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  // Stats removed as requested
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [userName, setUserName] = useState<string>('');
  
  const XP_CAP = 100; // Maximum XP per day
  const navigation = useNavigation();
  const user = FIREBASE_AUTH.currentUser;

  // Function to refresh data after XP modifications
  const handleXPUpdated = () => {
    // Trigger a refresh by incrementing the refresh trigger
    setRefreshTrigger(prev => prev + 1);
  };

  // Fetch user profile data
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      // Explicitly use the imported doc function
      const userRef = doc(FIREBASE_DB, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.fullName) {
          setUserName(userData.fullName);
        }
      }
    } catch (error) {
      // Logging removed for production ('Error fetching user profile:', error);
    }
  };
  
  // Set up real-time listener for user profile changes
  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(FIREBASE_DB, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        if (userData.fullName) {
          setUserName(userData.fullName);
        }
      }
    }, (error: Error) => {
      // Logging removed for production ('Error in profile listener:', error);
    });
    
    return () => {
      unsubscribeProfile();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch user profile data
    fetchUserProfile();

    // Reset tasks at midnight or when day changes
    const checkAndResetTasks = async () => {
      try {
        const now = new Date();
        const todayStr = formatDateString(now);
        const lastResetKey = `lastReset_${user.uid}`;
        const lastResetStr = await AsyncStorage.getItem(lastResetKey);
        const lastReset = lastResetStr ? new Date(lastResetStr) : null;

        // Check if it's a new day (not just app reload during development)
        if (!lastReset || 
            lastReset.getDate() !== now.getDate() || 
            lastReset.getMonth() !== now.getMonth() || 
            lastReset.getFullYear() !== now.getFullYear()) {
          
          // Logging removed for production ('Resetting tasks for new day:', now.toISOString());
          
          // Use the dedicated resetRecurringTasks function
          const result = await resetRecurringTasks();
          // Logging removed for production ('Reset recurring tasks result:', result);
          
          // Log the date transition for debugging
          // Logging removed for production (`Day transition detected: ${lastResetStr || 'initial'} -> ${now.toISOString()}`);
          // Logging removed for production (`Today's date string for comparison: ${todayStr}`);
          
          // Handle non-recurring completed tasks - remove them from the task list
          // This ensures completed non-recurring tasks don't show up the next day
          const batch = writeBatch(FIREBASE_DB);
          let removedCount = 0;
          
          // Get all completed non-recurring tasks
          const userTasksRef = collection(FIREBASE_DB, 'users', user.uid, 'tasks');
          const completedNonRecurringQuery = query(
            userTasksRef, 
            where('completed', '==', true),
            where('recurring', '==', false)
          );
          
          const completedSnapshot = await getDocs(completedNonRecurringQuery);
          
          // For each completed non-recurring task, update its lastCompletedDate
          // This will prevent it from showing up in the Dashboard but preserve it in ManageTasks
          completedSnapshot.forEach((doc) => {
            const task = doc.data() as Task;
            batch.update(doc.ref, {
              lastCompletedDate: todayStr
            });
            removedCount++;
          });
          
          if (removedCount > 0) {
            await batch.commit();
            // Logging removed for production (`Updated ${removedCount} completed non-recurring tasks`);
          }
          
          // Update last reset time
          await AsyncStorage.setItem(lastResetKey, now.toISOString());
        }
      } catch (error) {
        // Logging removed for production ('Error resetting tasks:', error);
      }
    };

    // Check for reset on component mount
    checkAndResetTasks();
    
    // Set up daily check - run every minute to catch day changes
    const resetInterval = setInterval(checkAndResetTasks, 60000);

    // Subscribe to tasks with filter for Dashboard
    // Only show tasks that are either:
    // 1. Not completed, or
    // 2. Completed today (for the Completed Tasks section)
    const todayStr = formatDateString(new Date());
    const unsubscribeTasks = subscribeToTasks((taskData) => {
        const todayStr = formatDateString(new Date());

        // Tasks To Complete: Not archived, not completed, either recurring or created today
        const tasksToComplete = taskData.filter(task => {
          if (task.archived) return false;
          if (task.recurring) return !task.completed;
          // Non-recurring: show if created today and not completed
          const createdToday = !!task.createdAt && formatDateString(new Date(task.createdAt.seconds * 1000)) === todayStr;
          return !task.completed && createdToday;
        });

        // Completed Tasks: Not archived, completed today
        const completedTasks = taskData.filter(task => {
          if (task.archived) return false;
          return !!task.completed && !!task.lastCompletedDate && task.lastCompletedDate === todayStr;
        });

        // Sort tasks to complete so pinned tasks appear first
        const sortedTasksToComplete = [...tasksToComplete].sort((a, b) => {
          // First sort by pinned status (pinned tasks first)
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          // Then sort by creation date (newest first) as a secondary sort
          if (a.createdAt && b.createdAt) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });
        
        // Combine or set state as needed (if you use setTasks for both, you may want to set both arrays in state)
        setTasks([...sortedTasksToComplete, ...completedTasks]);
        // If you have separate state for each section, use setTasksToComplete(tasksToComplete) and setCompletedTasks(completedTasks)

        setTasks([...tasksToComplete, ...completedTasks]);
    });

    return () => {
      unsubscribeTasks();
      clearInterval(resetInterval);
    };
  }, [user, refreshTrigger]);
  
  // Stats service subscription removed

  const handleTaskCompletion = async (taskId: string) => {
    try {
      // Find the task to display in the confirmation
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      
      // Show confirmation popup before completing the task
      Alert.alert(
        'Finishing your Task?',
        `Are you sure you want to complete "${task.title}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Confirm',
            onPress: async () => {
              const result = await completeTask(taskId);
              
              if (!result.success) {
                // Handle error case
                Alert.alert('Error', result.message || 'Failed to complete task');
              } else {
                // Task completed successfully
                // Check if XP was adjusted due to daily cap
                if (result.xpCapped) {
                  Alert.alert(
                    'Task Completed',
                    `Task completed! XP was automatically adjusted from ${result.originalXp} to ${result.awardedXP} to respect the daily cap of ${XP_CAP} XP.`
                  );
                } else {
                  Alert.alert('Success', `Task completed! Earned ${result.awardedXP} XP`);
                }
                
                // Update UI
                setRefreshTrigger(prev => prev + 1);
              }
            }
          }
        ]
      );
    } catch (error) {
      // Logging removed for production ('Error completing task:', error);
      Alert.alert('Error', 'Failed to complete task');
    }
  };

  // Handle toggling the pinned status of a task
  const handleTogglePinned = async (taskId: string, currentPinned: boolean) => {
    try {
      const result = await togglePinnedTask(taskId);
      if (!result.success) {
        Alert.alert('Error', result.message || 'Failed to update pinned status');
      }
      // No need to manually update state as the subscription will handle it
    } catch (error) {
      Alert.alert('Error', 'Failed to update pinned status');
    }
  };

  const renderTaskSection = (title: string, filteredTasks: Task[]) => (
    <View style={styles.section}>
      <Text style={Theme.Typography.h3}>{title}</Text>
      {filteredTasks.length > 0 ? (
        filteredTasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={[
              Theme.ComponentStyles.card, 
              task.completed && styles.completedTaskCard,
              task.pinned && !task.completed && styles.pinnedTaskCard
            ]}
            onPress={() => !task.completed && handleTaskCompletion(task.id)}
          >
            <View style={[Theme.ComponentStyles.spaceBetween, {flexWrap: 'wrap'}]}>
              <View style={[Theme.ComponentStyles.row, {flex: 1, minWidth: '70%', marginRight: Theme.Spacing.sm}]}>
                <Text style={styles.taskEmoji}>{task.emoji}</Text>
                <View style={{flex: 1, marginLeft: Theme.Spacing.sm}}>
                  <View style={[Theme.ComponentStyles.row, {alignItems: 'center'}]}>
                    <Text style={[Theme.Typography.h4, {flex: 1}]}>{task.title}</Text>
                    {!task.completed && (
                      <TouchableOpacity 
                        style={styles.pinButton}
                        onPress={() => handleTogglePinned(task.id, !!task.pinned)}
                      >
                        <MaterialIcons 
                          name={task.pinned ? "star" : "star-outline"} 
                          size={24} 
                          color={task.pinned ? Theme.Colors.warning : Theme.Colors.textSecondary} 
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  {task.pinned && !task.completed && (
                    <Text style={styles.pinnedLabel}>Pinned</Text>
                  )}
                </View>
              </View>
              <View style={[styles.xpBadge, {backgroundColor: task.completed ? Theme.Colors.success + '30' : Theme.Colors.primary + '30', marginTop: Theme.Spacing.xs}]}>
                <Text style={[Theme.Typography.bodySmall, {color: task.completed ? Theme.Colors.success : Theme.Colors.primary, fontWeight: '600'}]}>
                  +{task.xp} XP
                  {task.wasAdjusted && task.originalXp && (
                    <Text style={Theme.Typography.caption}> (adjusted from {task.originalXp})</Text>
                  )}
                </Text>
              </View>
            </View>
            
            {task.description ? (
              <Text style={[Theme.Typography.body, {marginTop: Theme.Spacing.sm}]}>{task.description}</Text>
            ) : null}
            
            {/* Subtasks section */}
            {task.subtasks && task.subtasks.length > 0 && (
              <View style={{marginTop: Theme.Spacing.sm, borderTopWidth: 1, borderTopColor: Theme.Colors.borderLight, paddingTop: Theme.Spacing.sm}}>
                <Text style={[Theme.Typography.bodySmall, {fontWeight: '600', marginBottom: Theme.Spacing.xs}]}>
                  Subtasks ({task.subtasks.length})
                </Text>
                {task.subtasks.map((subtask, index) => (
                  <View key={subtask.id} style={[Theme.ComponentStyles.row, {marginBottom: index === (task.subtasks?.length || 0) - 1 ? 0 : Theme.Spacing.xs, alignItems: 'center'}]}>
                    <MaterialIcons 
                      name={subtask.completed ? "check-circle" : "radio-button-unchecked"} 
                      size={16} 
                      color={subtask.completed ? Theme.Colors.success : Theme.Colors.textSecondary} 
                      style={{marginRight: Theme.Spacing.xs}}
                    />
                    <Text style={[Theme.Typography.bodySmall, {
                      color: Theme.Colors.textSecondary,
                      textDecorationLine: subtask.completed ? 'line-through' : 'none'
                    }]}>
                      {subtask.title}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            {task.completed && task.completedAt && (
              <View style={{marginTop: Theme.Spacing.sm, paddingTop: Theme.Spacing.sm, borderTopWidth: 1, borderTopColor: Theme.Colors.borderLight}}>
                <Text style={Theme.Typography.caption}>
                  Completed: {task.completedAt.toDate().toLocaleString()}
                </Text>
                {task.wasAdjusted && (
                  <Text style={[Theme.Typography.caption, {color: Theme.Colors.warning, marginTop: Theme.Spacing.xs}]}>
                    XP was adjusted to respect the daily cap of {XP_CAP} XP
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))
      ) : (
        <View style={[Theme.ComponentStyles.card, {alignItems: 'center', padding: Theme.Spacing.lg}]}>
          <Text style={[Theme.Typography.body, {color: Theme.Colors.textSecondary}]}>No tasks</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={Theme.ComponentStyles.container}>
      <View style={Theme.ComponentStyles.header}>
        <TouchableOpacity
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialIcons name="menu" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={Theme.ComponentStyles.headerTitle}>Dashboard</Text>
          {userName ? (
            <Text style={styles.welcomeText}>Welcome, {userName.split(' ')[0]}!</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Stats grid removed as requested */}

        {renderTaskSection(
          'Tasks To Complete',
          tasks.filter((task) => !task.completed)
        )}
        {renderTaskSection(
          'Completed Tasks',
          tasks.filter((task) => task.completed)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  taskEmoji: {
    fontSize: 24,
    marginRight: Theme.Spacing.sm,
  },
  completedTaskCard: {
    borderLeftWidth: 4,
    borderLeftColor: Theme.Colors.success,
  },
  pinnedTaskCard: {
    borderLeftWidth: 4,
    borderLeftColor: Theme.Colors.warning,
    borderTopWidth: 1,
    borderTopColor: Theme.Colors.warning,
    borderRightWidth: 1,
    borderRightColor: Theme.Colors.warning,
    borderBottomWidth: 1,
    borderBottomColor: Theme.Colors.warning,
  },
  pinButton: {
    padding: 8,
    marginLeft: 8,
  },
  pinnedLabel: {
    fontSize: 12,
    color: Theme.Colors.warning,
    fontWeight: 'bold',
    marginTop: 2,
  },
  xpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    padding: Theme.Spacing.md,
  },
  section: {
    marginBottom: Theme.Spacing.lg,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: Theme.Colors.textSecondary,
    marginTop: -5,
  },
});

export default Dashboard;
