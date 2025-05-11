import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Platform,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { addTask, updateTask, deleteTask } from '../utils/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateString } from '../utils/dateUtils';
import { Colors, Typography, Spacing, fontSizes } from '../styles/global';
import Theme from '../styles/theme';
import { useNavigation, DrawerActions } from '@react-navigation/native';

interface Task {
  id: string;
  title: string;
  description: string;
  emoji: string;
  xp: number;
  userId: string;
  recurring?: boolean;
  lastCompletedDate?: string;
  completed?: boolean;
  archivedDate?: string;
  archivedAt?: any; // Timestamp
  creationDate?: string; // ISO string for creation date
}

const XP_CAP = 100; // Maximum total XP allowed

const ManageTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [xp, setXp] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [totalXP, setTotalXP] = useState(0);
  const [availableXP, setAvailableXP] = useState(XP_CAP);

  const navigation = useNavigation();
  const user = FIREBASE_AUTH.currentUser;

  useEffect(() => {
    if (user) {
      // Check for day transition and clean up old non-recurring tasks
      const checkAndCleanupTasks = async () => {
        try {
          const now = new Date();
          const todayStr = formatDateString(now);
          const lastCleanupKey = `lastTaskCleanup_${user.uid}`;
          const lastCleanupStr = await AsyncStorage.getItem(lastCleanupKey);
          const lastCleanup = lastCleanupStr ? new Date(lastCleanupStr) : null;

          // Check if it's a new day or first run
          if (!lastCleanup || 
              lastCleanup.getDate() !== now.getDate() || 
              lastCleanup.getMonth() !== now.getMonth() || 
              lastCleanup.getFullYear() !== now.getFullYear()) {
            
            // Logging removed for production ('ManageTasks: Cleaning up old non-recurring tasks for new day:', now.toISOString());
            
            // Get all completed non-recurring tasks from previous days
            const userTasksRef = collection(FIREBASE_DB, 'users', user.uid, 'tasks');
            const oldTasksQuery = query(
              userTasksRef,
              where('recurring', '==', false),
              where('completed', '==', true)
            );
            
            const oldTasksSnapshot = await getDocs(oldTasksQuery);
            
            if (oldTasksSnapshot.size > 0) {
              // Create a batch for all updates
              const batch = writeBatch(FIREBASE_DB);
              let cleanupCount = 0;
              
              oldTasksSnapshot.forEach((doc) => {
                const task = doc.data() as Task;
                // Only process tasks from previous days
                if (task.lastCompletedDate && task.lastCompletedDate !== todayStr) {
                  // Mark the task with a special flag to indicate it should be hidden from ManageTasks
                  batch.update(doc.ref, {
                    archivedAt: serverTimestamp(),
                    archivedDate: todayStr
                  });
                  cleanupCount++;
                }
              });
              
              if (cleanupCount > 0) {
                await batch.commit();
                // Logging removed for production (`ManageTasks: Archived ${cleanupCount} old completed non-recurring tasks`);
              }
            }
            
            // Update last cleanup time
            await AsyncStorage.setItem(lastCleanupKey, now.toISOString());
          }
        } catch (error) {
          // Logging removed for production ('Error cleaning up old tasks:', error);
        }
      };
      
      // Run cleanup check on component mount
      checkAndCleanupTasks();
      
      // Also set up an interval to check periodically
      const cleanupInterval = setInterval(checkAndCleanupTasks, 60000);
      
      fetchTasks();
      
      // Set up a listener for task updates to refresh the task list
      // This ensures the UI updates immediately when tasks are completed
      const userTasksRef = collection(FIREBASE_DB, 'users', user.uid, 'tasks');
      const unsubscribe = onSnapshot(userTasksRef, 
        (snapshot: QuerySnapshot<DocumentData>) => {
          const taskList: Task[] = [];
          const today = new Date();
          const todayStr = formatDateString(today);
          
          snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const task = { id: doc.id, ...doc.data() } as Task;
            
            // Include all tasks that are:
            // 1. Recurring tasks (always show these regardless of completion status), or
            // 2. Non-recurring tasks that are NOT completed, or
            // 3. Non-recurring tasks that were completed TODAY ONLY
            // 4. And not archived
            const isRecurring = task.recurring === true;
            const isCompletedToday = task.completed && task.lastCompletedDate === todayStr;
            const isUncompleted = !task.completed;
            const isNonRecurringCompleted = !isRecurring && task.completed;
            const isArchived = task.archivedDate !== undefined;
            
            // Skip archived tasks
            if (isArchived) {
              return;
            }
            
            // CASE 1: Always include recurring tasks
            if (isRecurring) {
              taskList.push(task);
              return;
            }
            
            // CASE 2: For non-recurring tasks (both completed and uncompleted)
            // Only include if created today or completed today
            const createdToday = task.creationDate && formatDateString(new Date(task.creationDate)) === todayStr;
            const completedToday = task.completed && task.lastCompletedDate === todayStr;
            
            if (createdToday || completedToday) {
              taskList.push(task);
              // Logging removed for production (`ManageTasks including non-recurring task: ${task.title} (createdToday: ${createdToday}, completedToday: ${completedToday})`);
            } else {
              // Logging removed for production (`ManageTasks filtering out non-recurring task: ${task.title} (createdToday: ${createdToday}, completedToday: ${completedToday})`);
            }
            return; // Skip all other non-recurring tasks
          });
          
          // Log detailed task filtering information
          // Logging removed for production (`ManageTasks filtered ${snapshot.size} tasks to ${taskList.length} tasks for today (${todayStr})`);
          
          // Debug logging for task filtering
          if (snapshot.size > 0) {
            // Logging removed for production ('ManageTasks filtering details:');
            snapshot.forEach((doc) => {
              const task = { id: doc.id, ...doc.data() } as Task;
              const included = taskList.some(t => t.id === task.id);
              // Logging removed for production (`Task "${task.title}" (${task.id}): recurring=${!!task.recurring}, completed=${!!task.completed}, lastCompletedDate=${task.lastCompletedDate || 'none'}, included=${included}`);
            });
          }
          
          setTasks(taskList);
        }, 
        (error: Error) => {
          // Logging removed for production ('Error listening to tasks:', error);
        }
      );
      
      // Clean up the listener when component unmounts
      return () => {
        unsubscribe();
        clearInterval(cleanupInterval);
      };
    }
  }, [user]);
  
  // Calculate total and available XP whenever tasks change
  // Count all tasks (both completed and uncompleted) for XP planning
  // This maintains the 100 XP cap even after tasks are completed
  useEffect(() => {
    if (tasks.length === 0) return;
    
    // Calculate total XP from all tasks (both completed and uncompleted)
    const totalAllTasks = tasks.reduce((sum, task) => {
      // Make sure we're using a number for XP
      const taskXp = typeof task.xp === 'number' ? task.xp : parseInt(task.xp as any) || 0;
      return sum + taskXp;
    }, 0);
    
    // Calculate total XP from uncompleted tasks only (for display purposes)
    const uncompletedTasks = tasks.filter(task => task.completed !== true);
    const totalUncompleted = uncompletedTasks.reduce((sum, task) => {
      const taskXp = typeof task.xp === 'number' ? task.xp : parseInt(task.xp as any) || 0;
      return sum + taskXp;
    }, 0);
    
    // Logging removed for production ('Total XP from all tasks:', totalAllTasks);
    // Logging removed for production ('Total XP from uncompleted tasks:', totalUncompleted);
    
    // Use the total from all tasks to calculate available XP
    setTotalXP(totalAllTasks);
    setAvailableXP(Math.max(0, XP_CAP - totalAllTasks));
  }, [tasks]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      // Use the user-specific collection instead of the legacy collection
      const userTasksRef = collection(FIREBASE_DB, 'users', user.uid, 'tasks');
      const querySnapshot = await getDocs(userTasksRef);

      const taskList: Task[] = [];
      const today = new Date();
      const todayStr = formatDateString(today);
      
      querySnapshot.forEach((doc) => {
        const task = { id: doc.id, ...doc.data() } as Task;
        
        // Include all tasks that are:
        // 1. Recurring tasks (always show these regardless of completion status), or
        // 2. Non-recurring tasks that are NOT completed, or
        // 3. Non-recurring tasks that were completed TODAY ONLY
        // 4. And not archived
        const isRecurring = task.recurring === true;
        const isCompletedToday = task.completed && task.lastCompletedDate === todayStr;
        const isUncompleted = !task.completed;
        const isNonRecurringCompleted = !isRecurring && task.completed;
        const isArchived = task.archivedDate !== undefined;
        
        // Skip archived tasks
        if (isArchived) {
          return;
        }
        
        // CASE 1: Always include recurring tasks
        if (isRecurring) {
          taskList.push(task);
          return;
        }
        
        // CASE 2: For non-recurring tasks (both completed and uncompleted)
        // Only include if created today or completed today
        const createdToday = task.creationDate && formatDateString(new Date(task.creationDate)) === todayStr;
        const completedToday = task.completed && task.lastCompletedDate === todayStr;
        
        if (createdToday || completedToday) {
          taskList.push(task);
          // Logging removed for production (`ManageTasks including non-recurring task: ${task.title} (createdToday: ${createdToday}, completedToday: ${completedToday})`);
        } else {
          // Logging removed for production (`ManageTasks filtering out non-recurring task: ${task.title} (createdToday: ${createdToday}, completedToday: ${completedToday})`);
        }
        return; // Skip all other non-recurring tasks
      });

      // Log tasks for debugging
      // Logging removed for production ('Fetched tasks:', taskList.map(t => `${t.title} (completed: ${t.completed})`))

      setTasks(taskList);
    } catch (error) {
      // Logging removed for production ('Error fetching tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    }
  };

  const clearForm = () => {
    setTitle('');
    setDescription('');
    setEmoji('');
    setXp('');
    setRecurring(false);
    setEditingTask(null);
  };

  const handleAddTask = async () => {
    if (!user) return;

    try {
      const xpNumber = parseInt(xp);
      if (isNaN(xpNumber) || xpNumber <= 0) {
        Alert.alert('Error', 'XP must be a positive number');
        return;
      }
      
      // Calculate how much XP would be used after this operation
      let totalXpAfterOperation = totalXP;
      
      // If editing, subtract the original task's XP first
      if (editingTask) {
        totalXpAfterOperation -= editingTask.xp;
      }
      
      // Add the new XP value
      totalXpAfterOperation += xpNumber;
      
      // Check if the total XP would exceed the cap
      if (totalXpAfterOperation > XP_CAP) {
        Alert.alert(
          'XP Limit Exceeded', 
          `The total XP cannot exceed ${XP_CAP}. You have ${XP_CAP - (totalXP - (editingTask ? editingTask.xp : 0))} XP available.`,
          [{ text: 'OK' }]
        );
        return;
      }

      const taskData = {
        title,
        description,
        emoji,
        xp: xpNumber,
        recurring,
      };

      if (editingTask) {
        // Update existing task
        const taskData = {
          title,
          description,
          emoji,
          xp: xpNumber,
          recurring,
        };
        // Pass taskId and taskData as separate parameters
        const result = await updateTask(editingTask.id, taskData);
        if (!result.success) {
          Alert.alert('Error', result.message || 'Failed to update task');
          return;
        }
        if (result.message !== 'Task updated successfully') {
          Alert.alert('Success', result.message);
        }
      } else {
        // Add creationDate for new tasks
        const now = new Date();
        const todayStr = formatDateString(now);
        const taskDataWithCreation = {
          ...taskData,
          creationDate: todayStr
        };
        const result = await addTask(taskDataWithCreation);
        if (!result.success) {
          Alert.alert('Error', result.message || 'Failed to add task');
          return;
        }
        if (result.message && recurring) {
          Alert.alert('Success', result.message);
        }
      }
      clearForm();
      setModalVisible(false);
      fetchTasks();
    } catch (error) {
      // Logging removed for production ('Error saving task:', error);
      Alert.alert('Error', 'Failed to save task');
    }
  };


  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setEmoji(task.emoji);
    setXp(task.xp.toString());
    setRecurring(task.recurring || false);
    setModalVisible(true);
  };

  const handleDeleteTask = async (taskId: string, isCompleted: boolean) => {
    // Find the task object from state
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      Alert.alert('Error', 'Task not found.');
      return;
    }

    // Always use UTC for date checks
    const nowUTC = new Date();
    const todayUTCStr = formatDateString(new Date(Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate())));
    const isCompletedToday = task.completed && task.lastCompletedDate === todayUTCStr;

    // Prevent deletion of completed tasks if completed today (UTC)
    if (task.completed && isCompletedToday) {
      Alert.alert(
        'Cannot Delete Completed Task',
        'Completed tasks cannot be deleted on the day they were completed. You can modify them instead.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    // Allow deletion of any uncompleted task (recurring or non-recurring)
    if (!task.completed) {
      try {
        const result = await deleteTask(taskId);
        if (!result.success) {
          Alert.alert('Error', result.message || 'Failed to delete task');
          return;
        }
        fetchTasks();
      } catch (error) {
        Alert.alert('Error', 'Failed to delete task');
      }
      return;
    }

    // Block deletion for all other completed tasks
    Alert.alert(
      'Cannot Delete Completed Task',
      'Completed tasks cannot be deleted. You can modify them instead.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  
// Define styles at the component level to avoid reference errors
  const styles = StyleSheet.create({
    recycleButton: {
      backgroundColor: '#7B41DE', // Purple
      borderRadius: 20,
      minWidth: 44,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.small,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      flex: 1,
      padding: Spacing.medium,
    },
    disabledButton: {
      opacity: 0.5,
    },
    xpSummaryContainer: {
      backgroundColor: Colors.surface,
      borderRadius: 12,
      padding: Spacing.medium,
      margin: Spacing.medium,
      shadowColor: Colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    recurringTaskCard: {
      borderLeftWidth: 4,
      borderLeftColor: Theme.Colors.primary,
    },
    taskEmoji: {
      fontSize: 24,
      marginRight: Spacing.small,
    },
    recurringBadge: {
      // Deprecated: replaced by dailyBadge for animation and icon
    },
    dailyBadge: {},
    dailyBadgeText: {},
    xpBadge: {
      backgroundColor: Colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: Spacing.small,
    },
    taskActions: {
      flexDirection: 'row',
      marginTop: Spacing.small,
    },
    actionButton: {
      paddingVertical: Spacing.small,
      paddingHorizontal: Spacing.large,
      borderRadius: 20,
      marginRight: Spacing.small,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 44,
      minHeight: 36,
      elevation: 2,
      shadowColor: Colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
    },
    switchButton: {
      width: 50,
      height: 24,
      borderRadius: 12,
      padding: 2,
    },
    switchKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.background,
    },
    // Add any other styles used in the component
  });

  return (
    <View style={Theme.ComponentStyles.container}>
      <View style={Theme.ComponentStyles.header}>
        <TouchableOpacity
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialIcons name="menu" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
        <Text style={Theme.ComponentStyles.headerTitle}>Manage Tasks</Text>
        <TouchableOpacity
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => {
            clearForm();
            setModalVisible(true);
          }}
        >
          <MaterialIcons name="add" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={[Theme.ComponentStyles.card, {marginBottom: Theme.Spacing.lg}]}>
          <Text style={Theme.Typography.h3}>XP Planner</Text>
          <View style={{marginVertical: Theme.Spacing.sm}}>
            <View style={{
              height: 8,
              backgroundColor: Theme.Colors.borderLight,
              borderRadius: 4,
              overflow: 'hidden',
              marginVertical: Theme.Spacing.sm
            }}>
              <View 
                style={{
                  height: '100%',
                  width: `${(totalXP / XP_CAP) * 100}%`,
                  backgroundColor: totalXP > XP_CAP ? Theme.Colors.error : Theme.Colors.primary,
                  borderRadius: 4
                }} 
              />
            </View>
            <Text style={[Theme.Typography.bodySmall, {textAlign: 'right', color: Theme.Colors.textSecondary}]}>
              {totalXP}/{XP_CAP} XP used
            </Text>
          </View>
          <Text style={[Theme.Typography.h4, {color: Theme.Colors.primary, marginTop: Theme.Spacing.sm}]}>
            {availableXP} XP available to allocate
          </Text>
          <Text style={[Theme.Typography.body, {marginTop: Theme.Spacing.sm, color: Theme.Colors.textSecondary}]}>
            You've got {XP_CAP} XP to power your day! Assign XP to tasks based on how important or challenging they are. Choose wisely—every point counts!
          </Text>
        </View>

        {tasks.map((task) => (
          <View key={task.id} style={[Theme.ComponentStyles.card, task.recurring && styles.recurringTaskCard]}>
            <View style={[Theme.ComponentStyles.spaceBetween, {flexWrap: 'wrap'}]}>
              <View style={[Theme.ComponentStyles.row, {flex: 1, minWidth: '70%', marginRight: Theme.Spacing.sm}]}>
                <Text style={styles.taskEmoji}>{task.emoji}</Text>
                <View style={{flex: 1, marginLeft: Theme.Spacing.sm}}>
                  <Text style={Theme.Typography.h4}>{task.title}</Text>

                </View>
              </View>
              <View style={[styles.xpBadge, {backgroundColor: Theme.Colors.primary + '20', marginTop: Theme.Spacing.xs}]}>
                <Text style={[Theme.Typography.bodySmall, {color: Theme.Colors.primary, fontWeight: '600'}]}>+{task.xp} XP</Text>
              </View>
            </View>
            
            {task.description ? (
              <Text style={[Theme.Typography.body, {marginTop: Theme.Spacing.sm, color: Theme.Colors.textSecondary}]}>
                {task.description}
              </Text>
            ) : null}
            
            <View style={[styles.taskActions, {marginTop: Theme.Spacing.md, borderTopWidth: 1, borderTopColor: Theme.Colors.borderLight, paddingTop: Theme.Spacing.sm, justifyContent: 'flex-end', flexDirection: 'row'}]}>
              {task.recurring && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.recycleButton]}
                  onPress={() => {/* TODO: Implement reset logic if needed */}}
                  accessible={true}
                  accessibilityLabel="Reset recurring task"
                >
                  <MaterialIcons name="autorenew" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, {backgroundColor: Theme.Colors.surfaceHover}]}
                onPress={() => openEditModal(task)}
              >
                <MaterialIcons name="edit" size={20} color={Theme.Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, {backgroundColor: task.completed ? Theme.Colors.disabled : Theme.Colors.surfaceHover}]}
                onPress={() =>
                  Alert.alert(
                    'Delete Task',
                    task.completed
                      ? 'Completed tasks cannot be deleted , you can modify them instead.'
                      : 'Are you sure you want to delete this task?',
                    task.completed
                      ? [{ text: 'OK', style: 'default' }]
                      : [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            onPress: () => handleDeleteTask(task.id, !!task.completed),
                            style: 'destructive',
                          },
                        ]
                  )
                }
              >
                <MaterialIcons 
                  name="delete" 
                  size={20} 
                  color={task.completed ? Theme.Colors.textSecondary : Theme.Colors.error} 
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={Theme.ComponentStyles.modalOverlay}>
          <View style={Theme.ComponentStyles.modalContent}>
            <View style={Theme.ComponentStyles.modalHeader}>
              <Text style={Theme.Typography.h3}>
                {editingTask ? 'Edit Task' : 'New Task'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={Theme.Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={Theme.ComponentStyles.formGroup}>
              <Text style={Theme.ComponentStyles.formLabel}>Title</Text>
              <TextInput
                style={Theme.ComponentStyles.input}
                placeholder="Task title"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            
            <View style={Theme.ComponentStyles.formGroup}>
              <Text style={Theme.ComponentStyles.formLabel}>Description</Text>
              <TextInput
                style={[Theme.ComponentStyles.input, {minHeight: 80}]}
                placeholder="Task description"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>
            
            <View style={Theme.ComponentStyles.formGroup}>
              <Text style={Theme.ComponentStyles.formLabel}>Emoji</Text>
              <TextInput
                style={Theme.ComponentStyles.input}
                placeholder="📝"
                value={emoji}
                onChangeText={setEmoji}
                maxLength={2}
              />
            </View>
            
            <View style={Theme.ComponentStyles.formGroup}>
              <Text style={Theme.ComponentStyles.formLabel}>XP Value</Text>
              <TextInput
                style={Theme.ComponentStyles.input}
                placeholder="10"
                value={xp}
                onChangeText={setXp}
                keyboardType="numeric"
              />
            </View>
            
            <View style={[Theme.ComponentStyles.formGroup, Theme.ComponentStyles.row, {justifyContent: 'space-between'}]}>
              <Text style={Theme.ComponentStyles.formLabel}>Recurring Daily Task</Text>
              <TouchableOpacity 
                style={[styles.switchButton, {backgroundColor: recurring ? Theme.Colors.primaryLight : Theme.Colors.borderLight}]}
                onPress={() => setRecurring(!recurring)}
              >
                <View style={[styles.switchKnob, recurring && {transform: [{translateX: 20}], backgroundColor: Theme.Colors.textLight}]} />
              </TouchableOpacity>
            </View>
            
            {recurring && (
              <Text style={[Theme.Typography.caption, {color: Theme.Colors.info, marginBottom: Theme.Spacing.md}]}>
                This task will reset daily, allowing you to complete it every day for XP.
              </Text>
            )}
            
            <View style={[Theme.ComponentStyles.row, {justifyContent: 'space-between', marginTop: Theme.Spacing.md}]}>
              <TouchableOpacity
                style={[Theme.ComponentStyles.buttonOutline, {flex: 1, marginRight: Theme.Spacing.sm}]}
                onPress={() => {
                  clearForm();
                  setModalVisible(false);
                }}
              >
                <Text style={Theme.ComponentStyles.buttonTextOutline}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[Theme.ComponentStyles.buttonPrimary, {flex: 1, marginLeft: Theme.Spacing.sm}]}
                onPress={handleAddTask}
              >
                <Text style={Theme.ComponentStyles.buttonText}>
                  {editingTask ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  disabledButton: {
    opacity: 0.5,
  },
  xpSummaryContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.medium,
    margin: Spacing.medium,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  xpSummaryTitle: {
    ...Typography.subheading,
    marginBottom: Spacing.small,
    color: Colors.primary,
    fontWeight: '600',
  },
  xpProgressContainer: {
    marginVertical: Spacing.small,
  },
  xpProgressBarContainer: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    marginBottom: Spacing.small,
    overflow: 'hidden',
  },
  xpProgressBar: {
    height: 10,
    backgroundColor: Colors.primary,
  },
  xpText: {
    ...Typography.body,
    textAlign: 'right',
    color: Colors.text,
  },
  xpAvailableText: {
    ...Typography.body,
    color: Colors.success,
  },
  content: {
    flex: 1,
    padding: Theme.Spacing.md,
  },
  taskEmoji: {
    fontSize: 24,
    marginRight: Theme.Spacing.sm,
  },
  recurringTaskCard: {
    borderLeftWidth: 4,
    borderLeftColor: Theme.Colors.primary,
  },
  recurringBadge: {
    paddingHorizontal: Theme.Spacing.sm,
    paddingVertical: Theme.Spacing.xxs,
    borderRadius: Theme.Layout.radiusXs,
    alignSelf: 'flex-start',
    marginTop: Theme.Spacing.xs,
  },
  xpBadge: {
    paddingHorizontal: Theme.Spacing.sm,
    paddingVertical: Theme.Spacing.xs,
    borderRadius: Theme.Layout.radiusSm,
    alignSelf: 'flex-start',
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    padding: Theme.Spacing.sm,
    borderRadius: Theme.Layout.radiusSm,
    marginLeft: Theme.Spacing.sm,
  },
  switchButton: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.Colors.background,
  },
});

export default ManageTasks;
