import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  setDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  onSnapshot,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  increment,
  DocumentReference,
  QueryConstraint,
  Unsubscribe,
  writeBatch
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_DB, FIREBASE_AUTH } from '../../FirebaseConfig';
import { JournalEntry, UserStats, DailyStats as DailyStatsType, Task as TaskType } from '../types';

// Extended Task interface to include category, emoji, XP adjustment, recurring tasks, and offline support properties
export interface Task extends TaskType {
  // Additional properties are already defined in TaskType
}

// Define DailyStats interface to match the one in types/index.ts
export interface DailyStats extends DailyStatsType {
  // All properties are already defined in DailyStatsType
}

// Keep this for backward compatibility
export interface Task {
  id: string;
  title: string;
  description?: string;
  category?: string; // Making this optional for backward compatibility
  emoji?: string;   // Emoji for visual representation
  xp: number;       // Current XP value (may be adjusted when completed)
  plannedXp?: number; // Original planned XP value (never changes after creation)
  originalXp?: number; // Original XP value before adjustment due to daily cap
  wasAdjusted?: boolean; // Flag to indicate if XP was adjusted due to daily cap
  userId: string;
  completed: boolean;
  createdAt: Timestamp;
  completedAt?: Timestamp | null;
  isPending?: boolean; // Flag to indicate if the task has pending changes (for offline support)
  syncStatus?: 'synced' | 'pending' | 'error'; // Status of synchronization with the server
  lastSyncAttempt?: number; // Timestamp of the last sync attempt
  recurring?: boolean; // Flag to indicate if the task should recur daily
  lastCompletedDate?: string | null; // The date when the task was last completed (YYYY-MM-DD format)
  adjustmentReason?: string; // Reason why XP was adjusted
  archived?: boolean; // Flag to indicate if the task has been archived
}
import { formatDateString, dateToTimestamp } from './dateUtils';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { isRetryableError, logErrorWithContext } from './errorUtils';

// Constants
export const XP_CAP = 100; // Maximum total XP allowed per day
export const DEFAULT_WEEKLY_XP_GOAL = 700; // Default weekly XP goal (100 XP per day)

// XP Bank Action Types
export type XPBankActionType = 'completed' | 'modified' | 'deleted' | 'adjusted';

// XP bank record interface - This is the immutable XP execution layer record
export interface XPBankRecord {
  id: string;
  userId: string;
  date: string;
  taskId: string;
  taskTitle: string;
  xpAmount: number;      // Actual earned XP (may be adjusted)
  plannedXp?: number;    // Original planned XP from task creation
  originalXp?: number;   // Original XP before adjustment
  wasAdjusted?: boolean; // Flag if XP was adjusted
  adjustmentReason?: string; // Reason for adjustment
  actionType: 'completed' | 'adjusted' | 'deleted';
  timestamp: Timestamp;  // When this record was created
  taskData?: any;        // Copy of relevant task data at completion time
}

// Daily XP Bank Interface
export interface DailyXPBank {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  totalXP: number; // Total XP earned for the day (capped at XP_CAP)
  availableXP: number; // Available XP remaining for the day
  records: string[]; // Array of XPBankRecord IDs
  lastUpdated: Timestamp;
}

/**
 * Get or generate a unique device identifier for tracking actions across devices
 */
let deviceIdCache: string | null = null;
export const getDeviceId = async (): Promise<string> => {
  if (deviceIdCache) return deviceIdCache;
  
  try {
    // Try to get existing device ID from storage
    const storedId = await AsyncStorage.getItem('deviceId');
    
    if (storedId) {
      deviceIdCache = storedId;
      return storedId;
    }
    
    // Generate a new device ID if none exists
    const newId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await AsyncStorage.setItem('deviceId', newId);
    deviceIdCache = newId;
    return newId;
  } catch (error) {
    // Fallback if storage fails
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
};

/**
 * Get the current user ID or throw an error if not logged in
 */
export const getCurrentUserId = (): string => {
  const user = FIREBASE_AUTH.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
};

/**
 * Get the current user ID with error handling
 */
const getCurrentUserIdWithError = (): string => {
  const user = FIREBASE_AUTH.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.uid;
};

/**
 * Reset recurring tasks for a new day
 * 
 * This function checks for recurring tasks that were completed on previous days
 * and resets them to be available for completion today.
 * 
 * It also handles tasks that were never completed but should be reset for the new day.
 */
export const resetRecurringTasks = async (): Promise<{ success: boolean; message?: string; tasksReset?: number }> => {
  try {
    const userId = getCurrentUserIdWithError();
    const today = new Date();
    const todayStr = formatDateString(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateString(yesterday);
    
    // Get all tasks for the user
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    // Get all recurring tasks, both completed and uncompleted
    const userTasksQuery = query(userTasksRef, where('recurring', '==', true));
    const userTasksSnapshot = await getDocs(userTasksQuery);
    
    // Create a batch for all updates
    const batch = writeBatch(FIREBASE_DB);
    let tasksResetCount = 0;
    
    userTasksSnapshot.forEach((docSnapshot) => {
      const task = docSnapshot.data() as Task;
      let shouldReset = false;
      
      // Case 1: Recurring task that was completed on a previous day
      if (task.completed && task.lastCompletedDate && task.lastCompletedDate !== todayStr) {
        shouldReset = true;
      }
      
      // Case 2: Recurring task that wasn't completed yesterday but should be available today
      if (!task.completed && (!task.lastCompletedDate || task.lastCompletedDate < yesterdayStr)) {
        // This ensures tasks that weren't completed yesterday are still available today
        shouldReset = true;
      }
      
      if (shouldReset) {
        // Reset the task to be available for today
        batch.update(docSnapshot.ref, {
          completed: false,
          completedAt: null,
          // Don't update lastCompletedDate here to preserve streak tracking
        });
        
        // Only update the legacy collection if we're not disabling legacy access
        if (!DISABLE_LEGACY_TASKS_ACCESS) {
          try {
            const legacyTaskRef = doc(FIREBASE_DB, 'tasks', task.id);
            batch.update(legacyTaskRef, {
              completed: false,
              completedAt: null
            });
          } catch (legacyError) {
            console.warn(`Skipping legacy update for task ${task.id} due to possible permission issues`);
          }
        }
        
        tasksResetCount++;
      }
    });
    
    // Only commit if there are tasks to reset
    if (tasksResetCount > 0) {
      await batch.commit();
      console.log(`Reset ${tasksResetCount} recurring tasks for ${todayStr}`);
    } else {
      console.log('No recurring tasks needed to be reset');
    }
    
    return {
      success: true,
      message: `${tasksResetCount} recurring tasks reset for today`,
      tasksReset: tasksResetCount
    };
  } catch (error) {
    console.error('Error resetting recurring tasks:', error);
    return {
      success: false,
      message: `Error resetting recurring tasks: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Force reset all tasks for testing purposes
 * 
 * This function resets all tasks based on their recurring property:
 * - Recurring tasks: Reset to uncompleted state
 * - Non-recurring tasks: Leave completed tasks completed, reset uncompleted tasks
 * 
 * Use this function only for testing or when you need to manually reset the task state.
 */
export const forceResetAllTasks = async (): Promise<{ success: boolean; message?: string; tasksReset?: number }> => {
  try {
    const userId = getCurrentUserIdWithError();
    const today = new Date();
    const todayStr = formatDateString(today);
    
    // Get all tasks for the user
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const userTasksSnapshot = await getDocs(userTasksRef);
    
    // Create a batch for all updates
    const batch = writeBatch(FIREBASE_DB);
    let recurringTasksReset = 0;
    let nonRecurringTasksReset = 0;
    
    userTasksSnapshot.forEach((docSnapshot) => {
      const task = docSnapshot.data() as Task;
      
      // Handle recurring tasks - always reset to uncompleted
      if (task.recurring === true) {
        batch.update(docSnapshot.ref, {
          completed: false,
          completedAt: null,
          lastCompletedDate: task.completed ? todayStr : task.lastCompletedDate
        });
        recurringTasksReset++;
      }
      // Handle non-recurring tasks - only reset if they're not already completed
      else if (!task.completed) {
        // For non-recurring tasks that aren't completed, just ensure they're in the right state
        batch.update(docSnapshot.ref, {
          completed: false,
          completedAt: null
        });
        nonRecurringTasksReset++;
      }
      // Leave completed non-recurring tasks alone - they should stay completed
    });
    
    // Only commit if there are tasks to reset
    if (recurringTasksReset > 0 || nonRecurringTasksReset > 0) {
      await batch.commit();
      console.log(`Force reset ${recurringTasksReset} recurring tasks and ${nonRecurringTasksReset} non-recurring tasks`);
    } else {
      console.log('No tasks needed to be reset');
    }
    
    return {
      success: true,
      message: `Reset ${recurringTasksReset} recurring tasks and ${nonRecurringTasksReset} non-recurring tasks`,
      tasksReset: recurringTasksReset + nonRecurringTasksReset
    };
  } catch (error) {
    console.error('Error force resetting tasks:', error);
    return {
      success: false,
      message: `Error force resetting tasks: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Get user account creation date
 */
export const getUserCreationDate = (): Date => {
  const user = FIREBASE_AUTH.currentUser;
  if (!user) throw new Error('User not authenticated');
  return new Date(user.metadata.creationTime || Date.now());
};

// ===== TASKS =====

// Feature flag: Allow client to write to /dailyStats (global, not user-owned)
// This should be FALSE in production unless Firestore rules explicitly allow it
// If TRUE, the client will attempt to write to /dailyStats; if FALSE, it will skip and log a warning
export const ALLOW_CLIENT_DAILYSTATS_WRITE = false;

/**
 * Get all tasks for the current user from the user-specific collection
 */
export const getTasks = async (): Promise<Task[]> => {
  try {
    const userId = getCurrentUserId();
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const querySnapshot = await getDocs(userTasksRef);
    
    const tasks: Task[] = [];
    querySnapshot.forEach((doc) => {
      // Create a new object with id first to avoid duplication
      const taskData = doc.data();
      tasks.push({ 
        id: doc.id, 
        ...taskData 
      } as Task);
    });
    
    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

// Flag to control whether to check legacy tasks collection
// Set to true by default to avoid permission errors
// This prevents the app from trying to access the top-level tasks collection which may have stricter permissions
let DISABLE_LEGACY_TASKS_ACCESS = true;

/**
 * Helper function to safely convert Firestore Timestamp objects to ISO strings
 * This helps prevent Redux serialization errors
 */
const serializeTimestamp = (timestamp: Timestamp | null | undefined): string | null => {
  if (!timestamp) return null;
  try {
    return timestamp.toDate().toISOString();
  } catch (error) {
    console.warn('Error serializing timestamp:', error);
    return null;
  }
};

/**
 * Helper function to safely handle legacy collection operations
 * This ensures that errors in legacy collection operations don't affect the main operation
 */
const safelyUpdateLegacyCollection = async (
  taskId: string,
  updates: any
): Promise<boolean> => {
  if (DISABLE_LEGACY_TASKS_ACCESS) return false;
  
  try {
    const legacyTaskRef = doc(FIREBASE_DB, 'tasks', taskId);
    const legacyBatch = writeBatch(FIREBASE_DB);
    legacyBatch.update(legacyTaskRef, updates);
    await legacyBatch.commit();
    return true;
  } catch (error) {
    console.warn(`Legacy collection update failed for task ${taskId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

/**
 * Subscribe to tasks updates
 * 
 * This function uses the user-specific data structure with tasks stored under users/{userId}/tasks
 * The legacy /tasks collection is no longer used as all data has been migrated
 */
export const subscribeToTasks = (
  onNext: (tasks: Task[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  try {
    const userId = getCurrentUserId();
    
    // User-specific tasks collection
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const userTasksQuery = query(userTasksRef);
    
    // Also get completed tasks that were archived
    const completedTasksRef = collection(FIREBASE_DB, 'users', userId, 'completedTasks');
    const completedTasksQuery = query(completedTasksRef);
    
    // Subscribe to user-specific tasks collection
    const userTasksUnsubscribe = onSnapshot(userTasksQuery, (userTasksSnapshot) => {
      try {
        const userTasks: Task[] = [];
        userTasksSnapshot.forEach((doc) => {
          userTasks.push({ id: doc.id, ...doc.data() } as Task);
        });
        
        // Get completed tasks that were archived
        const completedTasksUnsubscribe = onSnapshot(completedTasksQuery, (completedTasksSnapshot) => {
          try {
            const completedTasks: Task[] = [];
            completedTasksSnapshot.forEach((doc) => {
              // Only include tasks that are marked as archived and completed
              const taskData = doc.data() as Task;
              if (taskData.archived && taskData.completed) {
                // Ensure timestamps are serialized properly to avoid Redux serialization issues
                const serializedTaskData = {
                  ...taskData,
                  createdAt: taskData.createdAt ? taskData.createdAt.toDate().toISOString() : null,
                  completedAt: taskData.completedAt ? taskData.completedAt.toDate().toISOString() : null
                };
                // For Redux compatibility, we need to handle the timestamps specially
                // First create a copy of the data without the id to avoid duplication
                const { id: docId, ...taskDataWithoutId } = taskData;
                
                // Then create a properly typed Task object with the serialized timestamps
                completedTasks.push({
                  id: doc.id,
                  ...taskDataWithoutId
                });
            }
          });
          // Combine user tasks and completed tasks
          const allTasks = [...userTasks, ...completedTasks];
          onNext(allTasks);
        } catch (completedError) {
          console.error('Error processing completed tasks:', completedError);
          // Still deliver the user tasks if we have them
          onNext(userTasks);
        }
      }, (error) => {
        console.error('Error in completed tasks listener:', error);
        // Still deliver the user tasks if we have them
        onNext(userTasks);
      });
          // Return unsubscribe function for both listeners
          return () => {
            userTasksUnsubscribe();
            completedTasksUnsubscribe();
          };
        } catch (processingError) {
          console.error('Error processing user tasks:', processingError);
          if (onError) onError(processingError as Error);
          // Return unsubscribe for user tasks only if completed tasks logic fails
          return () => {
            userTasksUnsubscribe();
          };
        }
      }, (error) => {
        console.error('Error in user tasks listener:', error);
        if (onError) onError(error as Error);
      });
      // Return unsubscribe for user tasks only if everything else fails
      return () => {
        userTasksUnsubscribe();
      };
    } catch (error) {
      console.error('Error setting up tasks listener:', error);
      if (onError) onError(error as Error);
      return () => {}; // Return empty unsubscribe function
    }
}

/**
 * Helper function to migrate a task from the legacy collection to the user-specific collection
 */
async function migrateTaskToUserCollection(task: Task): Promise<void> {
  try {
    const userId = task.userId;
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const newTaskRef = doc(userTasksRef, task.id);
    const batch = writeBatch(FIREBASE_DB);
    
    // Copy the task to the new location
    batch.set(newTaskRef, task);
    
    // Commit the batch
    await batch.commit();
    
    // Optionally delete from the old location
    // Uncomment once migration is complete and tested
    // const oldTaskRef = doc(FIREBASE_DB, 'tasks', task.id);
    // await deleteDoc(oldTaskRef);
    
    console.log(`Migrated task ${task.id} to user collection`);
  } catch (error) {
    console.error('Error migrating task:', error);
    throw error;
  }
};

/**
 * Add a new task
 * 
 * This function adds tasks to the user-specific collection under users/{userId}/tasks
 * It also supports recurring tasks that reset daily
 */
export const addTask = async (taskData: Omit<Task, 'id' | 'userId' | 'completed' | 'createdAt'>): Promise<{ success: boolean; message?: string; taskId?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const dateStr = formatDateString(now);
    
    // Get today's XP bank to check available XP
    const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', dateStr);
    const xpBankDoc = await getDoc(xpBankRef);
    const currentXpBank = xpBankDoc.exists() ? xpBankDoc.data() : null;
    
    // Calculate total planned XP for today (from existing tasks)
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const userTasksQuery = query(userTasksRef, where('completed', '==', false));
    const userTasksSnapshot = await getDocs(userTasksQuery);
    
    let plannedXpTotal = 0;
    userTasksSnapshot.forEach((doc) => {
      const task = doc.data() as Task;
      plannedXpTotal += task.xp || 0;
    });
    
    // Calculate earned XP from completed tasks
    const earnedXP = currentXpBank?.totalXP || 0;
    
    // Calculate available XP for planning
    const XP_CAP = 100;
    const availableForPlanning = Math.max(0, XP_CAP - earnedXP);
    
    // Store the original planned XP
    const plannedXp = taskData.xp;
    
    // Create a new task document with the planned XP
    const newTask: Omit<Task, 'id'> = {
      ...taskData,
      plannedXp: plannedXp, // Store the original planned XP
      userId,
      completed: false,
      createdAt: dateToTimestamp(now),
    };
    
    // Create a batch for all writes
    const batch = writeBatch(FIREBASE_DB);
    
    // Generate a new task ID
    const userTasksCollection = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const newTaskRef = doc(userTasksCollection);
    const taskId = newTaskRef.id;
    
    // Add to user-specific collection
    batch.set(newTaskRef, newTask);
    
    // Add to task history with enhanced tracking
    const taskHistoryRef = doc(collection(FIREBASE_DB, 'users', userId, 'taskHistory'));
    const deviceId = await getDeviceId();
    
    batch.set(taskHistoryRef, {
      taskId: taskId,
      title: taskData.title,
      description: taskData.description || '',
      category: taskData.category || 'uncategorized',
      xp: taskData.xp,
      plannedXp: plannedXp,  // Store planned XP in history
      date: dateStr,
      userId: userId,
      action: 'created',
      deviceId: deviceId,
      timestamp: serverTimestamp()
    });
    
    // Commit all changes
    await batch.commit();
    
    // Return success with the new task ID
    return {
      success: true,
      taskId: taskId,
      message: taskData.recurring 
        ? `Recurring task created successfully. It will reset daily.` 
        : 'Task added successfully'
    };
  } catch (error) {
    console.error('Error adding task:', error);
    return {
      success: false,
      message: `Error adding task: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Update an existing task
 * 
 * This function updates tasks in both the user-specific collection
 * and the legacy collection for backward compatibility
 * It also handles recurring task properties
 */
export const updateTask = async (taskId: string, updates: Partial<Omit<Task, 'id' | 'userId'>>): Promise<{ success: boolean; message?: string }> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const dateStr = formatDateString(now);
    
    // Get the current task data from user-specific collection
    const userTaskRef = doc(FIREBASE_DB, 'users', userId, 'tasks', taskId);
    const userTaskDoc = await getDoc(userTaskRef);
    
    if (!userTaskDoc.exists()) {
      return {
        success: false,
        message: `Task with ID ${taskId} not found`
      };
    }
    
    const task = userTaskDoc.data() as Task;
    
    // Store the original state for history tracking
    const originalState = { ...task };
    
    // Check if we're changing the recurring status
    const isChangingRecurringStatus = updates.hasOwnProperty('recurring') && updates.recurring !== task.recurring;
    
    // If changing from non-recurring to recurring, initialize lastCompletedDate if the task is completed
    if (isChangingRecurringStatus && updates.recurring === true && task.completed) {
      updates.lastCompletedDate = dateStr;
    }
    
    // If changing from recurring to non-recurring, DO NOT remove lastCompletedDate.
    // This ensures completed tasks remain visible for the rest of the day and are only removed the next day.
    // (No action needed here; retain lastCompletedDate as is.)
    
    // Use a batch write to ensure consistency across all collections
    const batch = writeBatch(FIREBASE_DB);
    
    // Clean up updates object to remove any undefined values
    // Firestore doesn't accept undefined values in updates
    const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
    
    // Update in user-specific collection only
    batch.update(userTaskRef, cleanUpdates);
    
    // Add to task history with enhanced tracking
    const taskHistoryRef = doc(collection(FIREBASE_DB, 'users', userId, 'taskHistory'));
    const deviceId = await getDeviceId();
    
    // Create a task history record with proper null handling for Firestore compatibility
    const taskHistoryRecord = {
      taskId: taskId,
      title: updates.title || task.title,
      description: updates.description || task.description || '',
      category: updates.category || task.category || 'uncategorized',
      xp: updates.xp !== undefined ? updates.xp : task.xp, // Use the updated XP if provided
      // Ensure completedAt is null rather than undefined if it doesn't exist
      completedAt: task.completedAt || null,
      date: dateStr,
      userId: userId,
      action: 'updated',
      recurring: updates.recurring !== undefined ? updates.recurring : task.recurring || false,
      previousState: originalState,
      updates: cleanUpdates,
      deviceId: deviceId,
      timestamp: serverTimestamp()
    };
    
    // Set the task history record, ensuring all fields have valid values
    batch.set(taskHistoryRef, taskHistoryRecord);
    
    // Commit the batch
    await batch.commit();
    
    return {
      success: true,
      message: isChangingRecurringStatus 
        ? (updates.recurring 
          ? 'Task updated and set to recur daily' 
          : 'Task updated and no longer recurring')
        : 'Task updated successfully'
    };
  } catch (error) {
    console.error('Error updating task:', error);
    return {
      success: false,
      message: `Error updating task: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Delete a task
 * 
 * This function deletes tasks from both the user-specific collection
 * and the legacy collection for backward compatibility
 */
/**
 * Delete a task from the planning layer (Manage Tasks)
 * 
 * This function removes a task from the active tasks collection,
 * but preserves any XP records if the task was completed.
 * 
 * The two-layer XP system ensures that:
 * 1. The task is removed from the planning layer (Manage Tasks)
 * 2. Any earned XP remains in the execution layer (XP Bank/History)
 */
export const deleteTask = async (taskId: string): Promise<{ success: boolean; message?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const dateStr = formatDateString(now);
    
    // First get the current task data to store in history
    let task: Task | null = null;
    let userTaskRef = doc(FIREBASE_DB, 'users', userId, 'tasks', taskId);
    const userTaskDoc = await getDoc(userTaskRef);
    
    if (userTaskDoc.exists()) {
      task = userTaskDoc.data() as Task;
    } else {
      // Try legacy collection
      const legacyTaskRef = doc(FIREBASE_DB, 'tasks', taskId);
      const legacyTaskDoc = await getDoc(legacyTaskRef);
      
      if (legacyTaskDoc.exists()) {
        task = legacyTaskDoc.data() as Task;
      } else {
        throw new Error('Task does not exist in either collection');
      }
    }
    
    // Store the original state for history tracking
    const originalState = { ...task };
    
    // Use a batch write to ensure consistency across all collections
    const batch = writeBatch(FIREBASE_DB);
    
    // If task is not completed, delete it completely
    // If task is completed, we'll keep it in a special collection for completed tasks
    if (!task.completed) {
      // Only delete from legacy collection if explicitly enabled
      if (!DISABLE_LEGACY_TASKS_ACCESS) {
        const legacyTaskRef = doc(FIREBASE_DB, 'tasks', taskId);
        batch.delete(legacyTaskRef);
      }
      // Delete from user-specific collection
      batch.delete(userTaskRef);
    } else {
      // For completed tasks, move to a special collection instead of deleting
      const completedTasksRef = doc(FIREBASE_DB, 'users', userId, 'completedTasks', taskId);
      
      // Mark as archived but preserve the task data
      batch.set(completedTasksRef, {
        ...task,
        archivedAt: serverTimestamp(),
        archived: true
      });
      
      // Delete from active collections
      if (!DISABLE_LEGACY_TASKS_ACCESS) {
        const legacyTaskRef = doc(FIREBASE_DB, 'tasks', taskId);
        batch.delete(legacyTaskRef);
      }
      batch.delete(userTaskRef);
    }
    
    // Add to task history with enhanced tracking
    const taskHistoryRef = doc(collection(FIREBASE_DB, 'users', userId, 'taskHistory'));
    const deviceId = await getDeviceId();
    
    // Create history record with safe handling of completedAt
    const historyRecord: any = {
      taskId: taskId,
      title: task.title,
      description: task.description || '',
      category: task.category || 'uncategorized',
      xp: task.xp,
      date: dateStr,
      userId: userId,
      action: 'deleted',
      previousState: originalState,
      deviceId: deviceId,
      timestamp: serverTimestamp()
    };
    
    // Only add completedAt if it exists
    if (task.completedAt) {
      historyRecord.completedAt = task.completedAt;
    }
    
    batch.set(taskHistoryRef, historyRecord);
    
    // If task was completed, add a record to XP bank for the deletion
    // but DO NOT remove the earned XP - this is part of the two-layer system
    if (task.completed && task.completedAt) {
      const completionDate = task.completedAt.toDate();
      const completionDateStr = formatDateString(completionDate);
      
      // Create XP bank record for the deletion (for tracking purposes only)
      const xpBankRecordRef = doc(collection(FIREBASE_DB, 'users', userId, 'xpBankRecords'));
      const xpBankRecordId = xpBankRecordRef.id;
      
      batch.set(xpBankRecordRef, {
        id: xpBankRecordId,
        userId: userId,
        date: dateStr,
        taskId: taskId,
        taskTitle: task.title,
        xpAmount: 0,  // No XP change - we're just recording the deletion
        plannedXp: task.plannedXp || task.xp,
        originalXp: task.xp, 
        actionType: 'deleted',
        timestamp: serverTimestamp(),
        taskData: {
          title: task.title,
          description: task.description || '',
          category: task.category || 'uncategorized',
          emoji: task.emoji || '',
          recurring: task.recurring || false,
          completedAt: task.completedAt
        }
      });
      
      // Update the XP bank for the day the task was completed
      // Note: We don't reduce the totalXP in the XP bank to prevent gaming the system
      // This ensures users can't delete completed tasks to free up XP for new tasks
      const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', completionDateStr);
      const xpBankDoc = await getDoc(xpBankRef);
      
      if (xpBankDoc.exists()) {
        batch.update(xpBankRef, {
          // Add the record ID but DO NOT reduce the totalXP or availableXP
          // This is critical to prevent users from gaming the system by deleting tasks
          records: arrayUnion(xpBankRecordId),
          lastUpdated: serverTimestamp()
        });
      }
      
      // Also move the task to the completedTasks collection to preserve its data
      // This ensures we have a record of completed tasks even after deletion
      const completedTaskRef = doc(FIREBASE_DB, 'users', userId, 'completedTasks', taskId);
      batch.set(completedTaskRef, {
        ...task,
        deletedAt: serverTimestamp(),
        isDeleted: true
      });
      
      // Update dailyStats collection for analytics
      // We don't reduce the XP in dailyStats to maintain consistency with XP bank
      // This ensures the analytics data accurately reflects the user's actual XP history
      const dailyStatsRef = doc(FIREBASE_DB, 'dailyStats', `${userId}_${completionDateStr}`);
      const dailyStatsDoc = await getDoc(dailyStatsRef);
      
      if (dailyStatsDoc.exists()) {
        // We don't modify the XP value here, just add the record of deletion
        // This maintains consistency with the XP bank approach
        batch.update(dailyStatsRef, {
          lastUpdated: serverTimestamp()
          // Do NOT reduce xpEarned to prevent gaming the system
          // This ensures users can't delete completed tasks to free up XP for new tasks
        });
      }
      
      // Also update the daily snapshot to ensure it maintains XP tracking
      const dailySnapshotRef = doc(FIREBASE_DB, 'users', userId, 'dailySnapshots', completionDateStr);
      const dailySnapshotDoc = await getDoc(dailySnapshotRef);
      
      if (dailySnapshotDoc.exists()) {
        // Critical: Do NOT reduce dailyXpBank when a task is deleted
        // This ensures the XP cap is still enforced even after task deletion
        batch.update(dailySnapshotRef, {
          lastUpdated: serverTimestamp()
        });
      }
    }
    
    // Commit the batch
    await batch.commit();
    
    // Return success status for the deletion
    return {
      success: true,
      message: 'Task deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting task:', error);
    return {
      success: false,
      message: `Error deleting task: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Complete a task and update user stats using batch writes for consistency
 * Enhanced with better error handling, retry mechanisms, and consistent XP persistence
 */
/**
 * Complete a task and update user stats using batch writes for consistency
 * Enhanced with better error handling, retry mechanisms, and consistent XP persistence
 * 
 * @param taskId - The ID of the task to complete
 * @param enforceXpCap - Whether to enforce the XP cap (default: true)
 * @param retryCount - Current retry attempt (for internal use)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise with completion status and XP information
 */
export const completeTask = async (
  taskId: string,
  enforceXpCap: boolean = true,
  retryCount: number = 0,
  maxRetries: number = 3
): Promise<{ success: boolean; message?: string; requiredXpAdjustment?: number; awardedXP?: number; originalXp?: number; dailyXpBeforeTask?: number; dailyXpAfterTask?: number; xpCapped?: boolean; xpCapReached?: boolean; remainingXpForToday?: number; }> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const dateStr = formatDateString(now);
    
    // Step 1: Get the task data from user-specific collection
    let task: Task | null = null;
    const userTaskRef = doc(FIREBASE_DB, 'users', userId, 'tasks', taskId);
    const userTaskDoc = await getDoc(userTaskRef);
    
    if (userTaskDoc.exists()) {
      task = userTaskDoc.data() as Task;
    } else {
      throw new Error('Task does not exist in user collection');
    }
    
    if (!task) {
      throw new Error('Failed to retrieve task data');
    }
    
    if (task.completed) {
      throw new Error('Task is already completed');
    }
    
    // Step 3: Get daily snapshot if it exists
    const dailySnapshotRef = doc(FIREBASE_DB, 'users', userId, 'dailySnapshots', dateStr);
    const dailySnapshotDoc = await getDoc(dailySnapshotRef);
    const dailySnapshot = dailySnapshotDoc.exists() ? dailySnapshotDoc.data() : null;
    
    // Step 4: Create a batch for all writes
    const batch = writeBatch(FIREBASE_DB);
    
    // Save original state for history
    const originalState = {
      completed: task.completed || false,
      completedAt: task.completedAt || null,
      title: task.title || '',
      description: task.description || '',
      category: task.category || 'uncategorized',
      xp: task.xp || 0
    };
    
    // Calculate current daily XP (for reference only)
    const XP_CAP = 100; // Daily XP cap
    const currentDailyXp = dailySnapshot?.dailyXpBank || 0;
    
    // TWO-LAYER XP SYSTEM IMPLEMENTATION
    
    // 1. Get the planned XP from the task (or use current xp if plannedXp not set)
    const plannedXp = task.plannedXp || task.xp;
    
    // 2. NO XP ADJUSTMENT - Always award the full planned XP
    // Since completed tasks can't be deleted, we don't need to adjust XP anymore
    
    // Set the task's earned XP to the full planned value
    const taskEarnedXp = plannedXp;
    
    // Calculate remaining XP (for informational purposes only)
    const remainingXP = Math.max(0, XP_CAP - currentDailyXp);
    
    // Log XP award
    console.log(`XP AWARDED: ${taskEarnedXp}. Current daily total: ${currentDailyXp}, Remaining cap: ${remainingXP}`);
    
    // No adjustment tracking needed since we always award full XP
    const wasAdjusted = false;
    const adjustmentReason = null;
    const originalXp = plannedXp; // For backward compatibility
    
    // Update task in both collections with completion status
    const completionData: any = {
      completed: true,
      completedAt: dateToTimestamp(now),
      lastCompletedDate: dateStr, // Track the date when the task was last completed
    };
    
    // Update the task with execution layer data
    // This records what actually happened when the task was completed
    completionData.xp = taskEarnedXp;         // The actual earned XP (may be adjusted)
    
    // Always store the planning layer data for reference
    completionData.plannedXp = plannedXp;     // The original planned XP (never changes)
    
    // If XP was adjusted, add additional fields for tracking
    if (wasAdjusted) {
      completionData.originalXp = originalXp;  // Original XP at time of completion
      completionData.wasAdjusted = true;
      completionData.adjustmentReason = adjustmentReason;
    }
    
    // Update the task in user-specific collection - we already verified it exists above
    batch.update(userTaskRef, completionData);
    
    // XP calculation is now done above before updating the task
    
    // Step 5: Create XP bank record for the completion
    const xpBankRecordRef = doc(collection(FIREBASE_DB, 'users', userId, 'xpBankRecords'));
    const xpBankRecordId = xpBankRecordRef.id;
        
    // Create an immutable XP execution layer record
    // This record will persist even if the task is later deleted
    batch.set(xpBankRecordRef, {
      id: xpBankRecordId,
      userId: userId,
      date: dateStr,
      taskId: taskId,
      taskTitle: task.title,
      xpAmount: taskEarnedXp,           // Actual earned XP (may be adjusted)
      plannedXp: plannedXp,             // Original planned XP from task creation
      originalXp: originalXp,           // XP value at time of completion
      wasAdjusted: wasAdjusted,         // Flag if XP was auto-adjusted
      adjustmentReason: adjustmentReason,
      actionType: 'completed',
      timestamp: serverTimestamp(),
      // Store a snapshot of relevant task data at completion time
      taskData: {
        title: task.title,
        description: task.description || '',
        category: task.category || 'uncategorized',
        emoji: task.emoji || '',
        recurring: task.recurring || false
      }
    });

    // Step 5b: Write to taskHistory for completion tracking
    const taskHistoryRef = doc(collection(FIREBASE_DB, 'users', userId, 'taskHistory'));
    batch.set(taskHistoryRef, {
      taskId: taskId,
      title: task.title,
      description: task.description || '',
      category: task.category || 'uncategorized',
      xp: taskEarnedXp,
      completedAt: dateToTimestamp(now),
      date: dateStr,
      userId: userId,
      action: 'completed',
      recurring: task.recurring || false,
      deviceId: await getDeviceId(),
      previousState: originalState,
      timestamp: serverTimestamp()
    });
        
    // Prepare the return data (will be returned after all operations complete)
    const returnData = {
      success: true,
      message: 'Task completed successfully',
      awardedXP: taskEarnedXp,
      originalXp: originalXp,
      dailyXpBeforeTask: currentDailyXp,
      dailyXpAfterTask: currentDailyXp + taskEarnedXp,
      xpCapped: false, // Always false since we don't cap XP anymore
      xpCapReached: currentDailyXp + taskEarnedXp >= XP_CAP,
      remainingXpForToday: Math.max(0, XP_CAP - (currentDailyXp + taskEarnedXp))
    };
        
    // Step 6: Update or create XP bank for today
    const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', dateStr);
    const xpBankDoc = await getDoc(xpBankRef);
    const xpBank = xpBankDoc.exists() ? xpBankDoc.data() : null;
    
    if (xpBank) {
      batch.update(xpBankRef, {
        totalXP: Math.min(XP_CAP, currentDailyXp + taskEarnedXp),
        availableXP: Math.max(0, XP_CAP - (currentDailyXp + taskEarnedXp)),
        records: arrayUnion(xpBankRecordId),
        lastUpdated: serverTimestamp()
      });
    } else {
      batch.set(xpBankRef, {
        id: dateStr,
        userId: userId,
        date: dateStr,
        totalXP: taskEarnedXp,
        availableXP: Math.max(0, XP_CAP - taskEarnedXp),
        records: [xpBankRecordId],
        lastUpdated: serverTimestamp()
      });
    }
    
    // Step 7: Update daily snapshots and stats for analytics with error handling
    try {
      // Get daily snapshot for analytics
      const dailySnapshotRef = doc(FIREBASE_DB, 'users', userId, 'dailySnapshots', dateStr);
      let dailySnapshot = null;
      
      try {
        const dailySnapshotDoc = await getDoc(dailySnapshotRef);
        dailySnapshot = dailySnapshotDoc.exists() ? dailySnapshotDoc.data() : null;
      } catch (snapshotError) {
        console.error('Error fetching daily snapshot, will create a new one:', snapshotError);
        // Continue without daily snapshot, we'll create one
      }
      
      // Calculate new daily XP total (capped at XP_CAP)
      const newDailyXpTotal = Math.min(XP_CAP, (dailySnapshot?.dailyXpBank || 0) + taskEarnedXp);
      
      // Update daily snapshot for analytics
      if (dailySnapshot) {
        // Calculate total XP after this task (capped at XP_CAP)
        const newDailyXpTotal = Math.min(XP_CAP, currentDailyXp + taskEarnedXp);
        
        batch.update(dailySnapshotRef, {
          tasksCompleted: (dailySnapshot.tasksCompleted || 0) + 1,
          xpEarned: (dailySnapshot.xpEarned || 0) + taskEarnedXp,
          dailyXpBank: newDailyXpTotal, // XP Bank tracks total XP earned today (capped at XP_CAP)
          tasksAdjusted: wasAdjusted ? 
            (dailySnapshot.tasksAdjusted || 0) + 1 : 
            (dailySnapshot.tasksAdjusted || 0),
          lastUpdated: dateToTimestamp(now)
        });
      } else {
        batch.set(dailySnapshotRef, {
          date: dateStr,
          userId: userId,
          tasksCompleted: 1,
          xpEarned: taskEarnedXp,
          dailyXpBank: Math.min(XP_CAP, taskEarnedXp), // Initialize XP Bank (capped at XP_CAP)
          tasksAdjusted: wasAdjusted ? 1 : 0,
          created: dateToTimestamp(now),
          lastUpdated: dateToTimestamp(now)
        });
      }
    } catch (snapshotError) {
      console.error('Error updating daily snapshot:', snapshotError);
      // Continue without blocking task completion
    }

    // Update dailyStats collection for analytics - critical for XP persistence
    const dailyStatsRef = doc(FIREBASE_DB, 'dailyStats', `${userId}_${dateStr}`);
    let dailyStats = null;
    try {
      const dailyStatsDoc = await getDoc(dailyStatsRef);
      dailyStats = dailyStatsDoc.exists() ? dailyStatsDoc.data() as DailyStats : null;
      // ... any additional logic for dailyStats (if needed)
    } catch (statsError) {
      console.error('Error updating dailyStats:', statsError);
      // Continue without blocking task completion
    }

    // Commit the batch after all operations
    try {
      await batch.commit();
      return returnData;
    } catch (commitError) {
      const errorMessage = commitError instanceof Error ? commitError.message : String(commitError);
      if (errorMessage.includes('No document to update')) {
        if (retryCount < 2) {
          console.log(`Retrying batch commit (attempt ${retryCount + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return completeTask(taskId, enforceXpCap, retryCount + 1);
        } else {
          throw new Error(`Failed to commit changes after multiple attempts: ${errorMessage}`);
        }
      }
      throw commitError;
    }
  } catch (error: unknown) {
    // Use our enhanced error logging utility
    logErrorWithContext('completeTask', error, {
      userId: getCurrentUserId(),
      taskId,
      retryAttempt: retryCount + 1,
      maxRetries
    });
    // Implement retry mechanism for transient errors
    if (retryCount < maxRetries && isRetryableError(error)) {
      console.log(`Retrying task completion (attempt ${retryCount + 1}/${maxRetries})...`);
      // Exponential backoff: wait longer between each retry
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      // Recursive retry with incremented counter
      return completeTask(taskId, enforceXpCap, retryCount + 1, maxRetries);
    }
    return {
      success: false,
      message: `Error completing task: ${error instanceof Error ? error.message : String(error)}`,
      awardedXP: 0,
      originalXp: 0,
      dailyXpBeforeTask: 0,
      dailyXpAfterTask: 0,
      xpCapped: false,
      xpCapReached: false,
      remainingXpForToday: 0
    };
  }
};

/**
 * Uncomplete a task and update user stats using batch writes for consistency
 */
export const uncompleteTask = async (taskId: string): Promise<{ success: boolean; message?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const dateStr = formatDateString(now);
    
    // Step 1: Get the task data from user-specific collection
    let task: Task | null = null;
    const userTaskRef = doc(FIREBASE_DB, 'users', userId, 'tasks', taskId);
    const userTaskDoc = await getDoc(userTaskRef);
    
    if (userTaskDoc.exists()) {
      task = userTaskDoc.data() as Task;
    } else {
      throw new Error('Task does not exist in user collection');
    }
    
    if (!task) {
      throw new Error('Failed to retrieve task data');
    }
    
    if (!task.completed || !task.completedAt) {
      throw new Error('Task is not completed');
    }
    
    // Create a batch for all writes
    const batch = writeBatch(FIREBASE_DB);
    
    // Store the original state for history tracking
    const originalState = { ...task };
    
    // Update task in both collections
    const uncompletionData = {
      completed: false,
      completedAt: null
    };
    
    // Update task in user-specific collection
    batch.update(userTaskRef, uncompletionData);
    
    // Get the date string from the task completion timestamp
    const completionDate = task.completedAt.toDate();
    const completionDateStr = formatDateString(completionDate);
    const todayDateStr = formatDateString(now);
    
    // Check if the task was completed today
    const completedToday = completionDateStr === todayDateStr;
    
    // Get user stats
    const userStatsRef = doc(FIREBASE_DB, 'users', userId);
    const userStatsDoc = await getDoc(userStatsRef);
    
    if (!userStatsDoc.exists()) {
      throw new Error('User stats not found');
    }
    
    const userStats = userStatsDoc.data() as UserStats;
    
    // Update user stats
    if (completedToday) {
      // Only decrement today's XP if the task was completed today
      batch.update(userStatsRef, {
        totalXP: increment(-task.xp),
        todayXP: increment(-task.xp)
      });
    } else {
      // Just decrement total XP if the task was completed on a different day
      batch.update(userStatsRef, {
        totalXP: increment(-task.xp)
      });
    }
    
    // Update daily snapshot if it exists
    // We already have completionDate and completionDateStr from earlier in the function
    
    // Update daily snapshot for the completion date
    const dailySnapshotRef = doc(FIREBASE_DB, 'users', userId, 'dailySnapshots', completionDateStr);
    const dailySnapshotDoc = await getDoc(dailySnapshotRef);
    
    if (dailySnapshotDoc.exists()) {
      const dailySnapshot = dailySnapshotDoc.data();
      const xpDifference = -task.xp;
      
      batch.update(dailySnapshotRef, {
        tasksCompleted: Math.max(0, (dailySnapshot.tasksCompleted || 1) - 1),
        xpEarned: Math.max(0, (dailySnapshot.xpEarned || task.xp) + xpDifference),
        dailyXpBank: Math.max(0, (dailySnapshot.dailyXpBank || task.xp) + xpDifference),
        lastUpdated: serverTimestamp()
      });
    }
    
    // Update dailyStats collection for analytics
    const dailyStatsRef = doc(FIREBASE_DB, 'dailyStats', `${userId}_${completionDateStr}`);
    const dailyStatsDoc = await getDoc(dailyStatsRef);
    
    if (dailyStatsDoc.exists()) {
      const dailyStats = dailyStatsDoc.data() as DailyStats;
      const xpDifference = -task.xp;
      
      batch.update(dailyStatsRef, {
        tasksCompleted: Math.max(0, (dailyStats.tasksCompleted || 1) - 1),
        xpEarned: Math.max(0, (dailyStats.xpEarned || task.xp) + xpDifference),
        lastUpdated: serverTimestamp()
      });
    }
    
    // Add to task history with enhanced tracking
    const taskHistoryRef = doc(collection(FIREBASE_DB, 'users', userId, 'taskHistory'));
    const deviceId = await getDeviceId();
    batch.set(taskHistoryRef, {
      taskId: taskId,
      title: task.title,
      description: task.description || '',
      category: task.category || 'uncategorized',
      xp: task.xp,
      completedAt: task.completedAt,
      date: dateStr,
      userId: userId,
      action: 'uncompleted',
      previousState: originalState,
      deviceId: deviceId,
      timestamp: serverTimestamp()
    });
    
    // Add record to XP bank for uncompleting the task
    const xpBankRecordRef = doc(collection(FIREBASE_DB, 'users', userId, 'xpBankRecords'));
    const xpBankRecordId = xpBankRecordRef.id;
    
    batch.set(xpBankRecordRef, {
      id: xpBankRecordId,
      userId: userId,
      date: dateStr,
      taskId: taskId,
      taskTitle: task.title,
      xpAmount: -task.xp, // Negative XP to represent uncompleting
      originalXp: task.xp, // Always include originalXp for uncompleting
      actionType: 'modified',
      timestamp: serverTimestamp()
    });
    
    // Update the XP bank for the day the task was completed
    const taskCompletionDateStr = formatDateString(completionDate);
    const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', taskCompletionDateStr);
    const xpBankDoc = await getDoc(xpBankRef);
    
    if (xpBankDoc.exists()) {
      batch.update(xpBankRef, {
        records: arrayUnion(xpBankRecordId),
        lastUpdated: serverTimestamp()
        // Note: We don't update totalXP to prevent gaming the system
      });
    }
    
    // Commit all changes
    await batch.commit();
    
    // Return success status for the deletion
    return {
      success: true,
      message: 'Task deleted successfully'
    };
    
  } catch (error) {
    console.error('Error uncompleting task:', error);
    return {
      success: false,
      message: `Error uncompleting task: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// ===== JOURNALS =====

/**
 * Save a journal entry for a specific date
 */
export const saveJournalEntry = async (
  entry: Omit<JournalEntry, 'userId' | 'timestamp'>, 
  date: Date = new Date()
): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const dateStr = formatDateString(date);
    
    await setDoc(doc(FIREBASE_DB, 'users', userId, 'journal', dateStr), {
      ...entry,
      userId,
      timestamp: dateToTimestamp(date),
    });
    
    // Update daily stats to mark that this day has a journal
    const dailyStatsRef = doc(FIREBASE_DB, 'dailyStats', `${userId}_${dateStr}`);
    const dailyStatsDoc = await getDoc(dailyStatsRef);
    
    if (dailyStatsDoc.exists()) {
      await updateDoc(dailyStatsRef, {
        hasJournal: true,
      });
    } else {
      await setDoc(dailyStatsRef, {
        userId,
        date: dateStr,
        tasksCompleted: 0,
        xpEarned: 0,
        hasJournal: true,
        timestamp: dateToTimestamp(date),
      });
    }
    
    // Update user stats to mark last active
    const userStatsRef = doc(FIREBASE_DB, 'users', userId);
    const userStatsDoc = await getDoc(userStatsRef);
    
    if (userStatsDoc.exists()) {
      await updateDoc(userStatsRef, {
        lastActive: dateToTimestamp(date),
      });
    }
  } catch (error) {
    console.error('Error saving journal entry:', error);
    throw error;
  }
};

/**
 * Get a journal entry for a specific date
 */
export const getJournalEntry = async (date: Date = new Date()): Promise<JournalEntry | null> => {
  try {
    const userId = getCurrentUserId();
    const dateStr = formatDateString(date);
    const docRef = doc(FIREBASE_DB, 'users', userId, 'journal', dateStr);
    const snapshot = await getDoc(docRef);
    
    if (snapshot.exists()) {
      return snapshot.data() as JournalEntry;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting journal entry:', error);
    throw error;
  }
};

/**
 * Subscribe to journal entries
 */
export const subscribeToJournalEntries = (
  entryLimit: number = 10,
  onNext: (entries: (JournalEntry & { date: string })[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  try {
    const userId = getCurrentUserId();
    const journalRef = collection(FIREBASE_DB, 'users', userId, 'journal');
    
    // Simplify the query to avoid potential issues
    // First create a basic query without the limit
    let journalQuery = query(journalRef);
    
    // Then add the orderBy if needed
    try {
      journalQuery = query(journalRef, orderBy('timestamp', 'desc'));
    } catch (orderByError) {
      console.warn('Could not add orderBy to journal query:', orderByError);
    }
    
    // Finally add the limit
    try {
      journalQuery = query(journalQuery, limit(entryLimit));
    } catch (limitError) {
      console.warn('Could not add limit to journal query:', limitError);
    }
    
    return onSnapshot(journalQuery, 
      (snapshot) => {
        try {
          const entries = snapshot.docs.map(doc => ({
            date: doc.id,
            ...(doc.data() as JournalEntry)
          }));
          onNext(entries);
        } catch (mapError) {
          console.error('Error processing journal entries:', mapError);
          if (onError) onError(mapError as Error);
        }
      }, 
      (error) => {
        console.error('Error in journal entries listener:', error);
        if (onError) onError(error as Error);
      }
    );
  } catch (error) {
    console.error('Error setting up journal entries listener:', error);
    if (onError) onError(error as Error);
    return () => {}; // Return empty unsubscribe function
  }
};

// ===== XP BANK MANAGEMENT =====

/**
 * Calculate the user's total XP by summing all xpBank docs.
 */
export const getTotalXPFromBank = async (): Promise<number> => {
  try {
    const userId = getCurrentUserId();
    const xpBankRef = collection(FIREBASE_DB, 'users', userId, 'xpBank');
    const snapshot = await getDocs(xpBankRef);
    let totalXP = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (typeof data.totalXP === 'number') {
        totalXP += data.totalXP;
      }
    });
    return totalXP;
  } catch (error) {
    console.error('Error calculating total XP from xpBank:', error);
    throw error;
  }
};

/**
 * Get today's XP from xpBank (today's totalXP).
 */
export const getTodayXPFromBank = async (): Promise<number> => {
  const today = new Date();
  const xpBank = await getXPBank(today);
  return xpBank?.totalXP || 0;
};

/**
 * Get the XP bank for a specific date
 */
export const getXPBank = async (date: Date = new Date()): Promise<DailyXPBank | null> => {
  try {
    const userId = getCurrentUserId();
    const dateStr = formatDateString(date);
    const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', dateStr);
    const xpBankDoc = await getDoc(xpBankRef);
    
    if (xpBankDoc.exists()) {
      return xpBankDoc.data() as DailyXPBank;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting XP bank:', error);
    throw error;
  }
};

/**
 * Get XP bank records for a specific date
 */
export const getXPBankRecords = async (date: Date = new Date()): Promise<XPBankRecord[]> => {
  try {
    const userId = getCurrentUserId();
    const dateStr = formatDateString(date);
    
    // Get the XP bank first to get the record IDs
    const xpBank = await getXPBank(date);
    
    if (!xpBank || !xpBank.records || xpBank.records.length === 0) {
      return [];
    }
    
    // Get all the records
    const records: XPBankRecord[] = [];
    
    for (const recordId of xpBank.records) {
      const recordRef = doc(FIREBASE_DB, 'users', userId, 'xpBankRecords', recordId);
      const recordDoc = await getDoc(recordRef);
      
      if (recordDoc.exists()) {
        records.push(recordDoc.data() as XPBankRecord);
      }
    }
    
    // Sort by timestamp (newest first)
    return records.sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return b.timestamp.seconds - a.timestamp.seconds;
    });
  } catch (error) {
    console.error('Error getting XP bank records:', error);
    throw error;
  }
};

/**
 * Modify the XP value of a completed task
 * This function allows users to adjust the XP value of a task after completion
 */
export const modifyTaskXP = async (
  taskId: string,
  newXpValue: number
): Promise<{ success: boolean; message?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const dateStr = formatDateString(now);
    
    // Get the task
    let task: Task | null = null;
    let taskRef: DocumentReference | null = null;
    let userTaskRef: DocumentReference | null = null;
    
    // Try user-specific collection first
    userTaskRef = doc(FIREBASE_DB, 'users', userId, 'tasks', taskId);
    const userTaskDoc = await getDoc(userTaskRef);
    
    if (userTaskDoc.exists()) {
      task = userTaskDoc.data() as Task;
      taskRef = doc(FIREBASE_DB, 'tasks', taskId); // Set legacy ref too
    } else {
      // Try legacy collection
      taskRef = doc(FIREBASE_DB, 'tasks', taskId);
      const taskDoc = await getDoc(taskRef);
      
      if (taskDoc.exists()) {
        task = taskDoc.data() as Task;
      } else {
        return {
          success: false,
          message: 'Task does not exist'
        };
      }
    }
    
    if (!task.completed) {
      return {
        success: false,
        message: 'Cannot modify XP for incomplete task'
      };
    }
    
    // Validate new XP value
    if (newXpValue <= 0) {
      return {
        success: false,
        message: 'XP value must be greater than 0'
      };
    }
    
    // Get the XP bank for today
    const xpBank = await getXPBank(now);
    const currentTotalXp = xpBank?.totalXP || 0;
    
    // Calculate the XP difference
    const originalXp = task.xp;
    const xpDifference = newXpValue - originalXp;
    
    // Check if the modification would exceed the daily cap
    if (xpDifference > 0 && currentTotalXp + xpDifference > XP_CAP) {
      return {
        success: false,
        message: `Increasing XP would exceed your daily cap. You can only add ${Math.max(0, XP_CAP - currentTotalXp)} more XP today.`
      };
    }
    
    // Create a batch for all writes
    const batch = writeBatch(FIREBASE_DB);
    
    // Update the task XP in both collections
    const updateData = {
      xp: newXpValue,
      originalXp: originalXp // Store the original XP for reference
    };
    
    if (taskRef) {
      batch.update(taskRef, updateData);
    }
    
    if (userTaskRef) {
      batch.update(userTaskRef, updateData);
    }
    
    // Create XP bank record for the modification
    const xpBankRecordRef = doc(collection(FIREBASE_DB, 'users', userId, 'xpBankRecords'));
    const xpBankRecordId = xpBankRecordRef.id;
    
    batch.set(xpBankRecordRef, {
      id: xpBankRecordId,
      userId: userId,
      date: dateStr,
      taskId: taskId,
      taskTitle: task.title,
      xpAmount: xpDifference,
      originalXp: originalXp, // Always include originalXp for modifications
      actionType: 'modified',
      timestamp: serverTimestamp()
    });
    
    // Update the XP bank
    if (xpBank) {
      const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', dateStr);
      batch.update(xpBankRef, {
        totalXP: Math.min(XP_CAP, currentTotalXp + xpDifference),
        availableXP: Math.max(0, XP_CAP - (currentTotalXp + xpDifference)),
        records: arrayUnion(xpBankRecordId),
        lastUpdated: serverTimestamp()
      });
    } else {
      // Create a new XP bank if it doesn't exist
      const xpBankRef = doc(FIREBASE_DB, 'users', userId, 'xpBank', dateStr);
      batch.set(xpBankRef, {
        id: dateStr,
        userId: userId,
        date: dateStr,
        totalXP: Math.min(XP_CAP, xpDifference),
        availableXP: Math.max(0, XP_CAP - xpDifference),
        records: [xpBankRecordId],
        lastUpdated: serverTimestamp()
      } as DailyXPBank);
    }
    
    // Step 4: Get user stats with fallback mechanism
    let userStats: UserStats | null = null;
    try {
      const userStatsRef = doc(FIREBASE_DB, 'users', userId);
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        userStats = userStatsDoc.data() as UserStats;
      }
    } catch (statsError) {
      console.error('Error fetching user stats, will create new stats:', statsError);
      // Continue without user stats, we'll create new ones later
    }
    
    if (userStats) {
      batch.update(doc(FIREBASE_DB, 'users', userId), {
        totalXP: userStats.totalXP + xpDifference,
        todayXP: Math.min(XP_CAP, Math.max(0, userStats.todayXP + xpDifference))
      });
    } else {
      batch.set(doc(FIREBASE_DB, 'users', userId), {
        userId: userId,
        totalXP: xpDifference,
        todayXP: Math.min(XP_CAP, xpDifference),
        streakCount: 1,
        lastActive: dateToTimestamp(now),
        bestDay: dateStr,
        bestDayXP: xpDifference,
        weeklyXPGoal: DEFAULT_WEEKLY_XP_GOAL,
        lastReset: dateToTimestamp(now)
      } as UserStats);
    }
    
    // Check if the task was completed today
    let completedToday = false;
    if (task.completedAt) {
      const completionDate = task.completedAt.toDate();
      const completionDateStr = formatDateString(completionDate);
      completedToday = completionDateStr === dateStr;
    }
    
    // Update dailyStats collection for analytics if the task was completed today
    if (completedToday) {
      const dailyStatsRef = doc(FIREBASE_DB, 'dailyStats', `${userId}_${dateStr}`);
      const dailyStatsDoc = await getDoc(dailyStatsRef);
      
      if (dailyStatsDoc.exists()) {
        const dailyStats = dailyStatsDoc.data() as DailyStats;
        batch.update(dailyStatsRef, {
          xpEarned: Math.max(0, (dailyStats.xpEarned || 0) + xpDifference),
          lastUpdated: serverTimestamp()
        });
      } else {
        // Create a new daily stats document if it doesn't exist
        batch.set(dailyStatsRef, {
          id: `${userId}_${dateStr}`,
          date: dateStr,
          userId: userId,
          tasksCompleted: 1, // At least this task is completed
          xpEarned: Math.max(0, xpDifference),
          created: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });
      }
    }
    
    // Commit all changes
    await batch.commit();
    
    // Return success status for the deletion
    return {
      success: true,
      message: 'Task deleted successfully'
    };
  } catch (error) {
    console.error('Error modifying task XP:', error);
    return {
      success: false,
      message: `Error modifying task XP: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

// ===== ANALYTICS & HISTORY =====

/**
 * Interface for task history records with enhanced tracking
 */
export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  category?: string;
  xp: number;
  completedAt: Timestamp | null;
  date: string; // YYYY-MM-DD format
  userId: string;
  action: 'completed' | 'uncompleted' | 'created' | 'updated' | 'deleted'; // Track all actions
  recurring?: boolean; // Whether this task is a recurring task
  previousState?: any; // Store previous state for updates/uncompletes
  updates?: any; // Store updates for update actions
  deviceId?: string; // Track which device performed the action
  timestamp: Timestamp; // When the history record was created (server timestamp)
}

/**
 * Subscribe to task history with enhanced filtering capabilities
 * 
 * This function allows the app to access a user's complete task history
 * across all devices, providing a consistent view of all task actions
 * with comprehensive filtering options.
 */
export const subscribeToTaskHistory = (
  options: {
    startDate?: Date | null,
    endDate?: Date | null,
    actions?: Array<TaskHistoryRecord['action']>,
    category?: string,
    searchText?: string,
    limit?: number,
    recurring?: boolean // Add option to filter by recurring tasks
  },
  onNext: (history: TaskHistoryRecord[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  try {
    const userId = getCurrentUserId();
    const historyRef = collection(FIREBASE_DB, 'users', userId, 'taskHistory');
    
    // Use a simple query with only timestamp ordering to avoid index requirements
    // We'll do all filtering client-side
    const historyQuery = query(
      historyRef, 
      orderBy('timestamp', 'desc'),
      // Only apply a limit if specified, with a default maximum to prevent excessive data transfer
      limit(options.limit || 500)
    );
    
    // Subscribe to the query
    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      let historyRecords: TaskHistoryRecord[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        historyRecords.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp || Timestamp.now() // Fallback for old records
        } as TaskHistoryRecord);
      });
      
      // Apply all filters client-side to avoid Firestore composite index requirements
      
      // Filter by action type if specified
      if (options.actions && options.actions.length > 0) {
        historyRecords = historyRecords.filter(record => 
          options.actions!.includes(record.action)
        );
      }
      
      // Filter by category if specified
      if (options.category) {
        historyRecords = historyRecords.filter(record => 
          record.category === options.category
        );
      }
      
      // Apply date filters
      if (options.startDate) {
        const startDateStr = formatDateString(options.startDate);
        historyRecords = historyRecords.filter(record => record.date >= startDateStr);
      }
      
      if (options.endDate) {
        const endDateStr = formatDateString(options.endDate);
        historyRecords = historyRecords.filter(record => record.date <= endDateStr);
      }
      
      // Apply text search filter if provided
      if (options.searchText) {
        const searchLower = options.searchText.toLowerCase();
        historyRecords = historyRecords.filter(record => 
          record.title.toLowerCase().includes(searchLower) ||
          (record.description && record.description.toLowerCase().includes(searchLower))
        );
      }
      
      // Filter by recurring tasks if specified
      if (options.recurring !== undefined) {
        historyRecords = historyRecords.filter(record => 
          record.recurring === options.recurring
        );
      }
      
      onNext(historyRecords);
    }, onError);
    
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to task history:', error);
    if (onError) onError(error as Error);
    return () => {}; // Return empty unsubscribe function
  }
};

// Old subscribeToTaskHistory function has been replaced with the enhanced version above

/**
 * Interface for daily snapshots
 */
export interface DailyXPBank {
  id: string;
  userId: string;
  date: string;
  totalXP: number;
  availableXP: number;
  records: string[];
  lastUpdated: Timestamp;
}

export interface DailyStats {
  id: string;
  date: string;
  userId: string;
  tasksCompleted: number;
  xpEarned: number;
  created: Timestamp;
  lastUpdated: Timestamp;
}

export interface DailySnapshot {
  date: string;
  userId: string;
  tasksCompleted: number;
  xpEarned: number;
  dailyXpBank: number;
  created: Timestamp;
  lastUpdated: Timestamp;
}

/**
 * Subscribe to daily snapshots
 * 
 * This function provides access to the daily snapshots collection,
 * which ensures consistent analytics data across devices
 */
export const subscribeToDailySnapshots = (
  startDate: Date | null = null,
  endDate: Date | null = null,
  onNext: (snapshots: DailySnapshot[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  try {
    const userId = getCurrentUserId();
    const snapshotsRef = collection(FIREBASE_DB, 'users', userId, 'dailySnapshots');
    
    // Create a query ordered by date (newest first)
    let snapshotsQuery = query(snapshotsRef, orderBy('date', 'desc'));
    
    // Apply date filters if provided
    if (startDate) {
      const startDateStr = formatDateString(startDate);
      snapshotsQuery = query(snapshotsQuery, where('date', '>=', startDateStr));
    }
    
    if (endDate) {
      const endDateStr = formatDateString(endDate);
      snapshotsQuery = query(snapshotsQuery, where('date', '<=', endDateStr));
    }
    
    return onSnapshot(snapshotsQuery, (snapshot) => {
      const snapshots: DailySnapshot[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        snapshots.push({
          ...data,
          created: data.created as Timestamp,
          lastUpdated: data.lastUpdated as Timestamp
        } as DailySnapshot);
      });
      
      onNext(snapshots);
    }, (error) => {
      console.error('Error in daily snapshots listener:', error);
      if (onError) onError(error as Error);
    });
  } catch (error) {
    console.error('Error setting up daily snapshots listener:', error);
    if (onError) onError(error as Error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Subscribe to daily stats
 */
export const subscribeToDailyStats = (
  startDate: Date | null = null,
  endDate: Date | null = null,
  onNext: (stats: DailyStats[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  try {
    const userId = getCurrentUserId();
    const dailyStatsRef = collection(FIREBASE_DB, 'dailyStats');
    
    // Using a simpler query to avoid composite index requirements
    // We'll filter the results in memory instead
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId)
    ];
    
    // Note: We're not using orderBy to avoid requiring a composite index
    // We'll sort the results client-side instead
    
    // Note: We're not adding date range filters in the query
    // to avoid requiring a composite index
    // We'll filter the results client-side instead
    
    const q = query(dailyStatsRef, ...constraints);
    
    return onSnapshot(q, (snapshot) => {
      const stats: DailyStats[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as DailyStats;
        
        // Apply date range filtering client-side if needed
        if (startDate && endDate) {
          const dateStr = data.date;
          if (dateStr >= formatDateString(startDate) && dateStr <= formatDateString(endDate)) {
            stats.push(data);
          }
        } else {
          stats.push(data);
        }
      });
      
      // Sort the results by date in descending order (newest first)
      stats.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
      });
      onNext(stats);
    }, (error) => {
      console.error('Error in daily stats listener:', error);
      if (onError) onError(error as Error);
    });
  } catch (error) {
    console.error('Error setting up daily stats listener:', error);
    if (onError) onError(error as Error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Get user stats
 */
export const getUserStats = async (): Promise<UserStats> => {
  try {
    const userId = getCurrentUserId();
    const userStatsRef = doc(FIREBASE_DB, 'users', userId);
    const userStatsDoc = await getDoc(userStatsRef);
    
    if (userStatsDoc.exists()) {
      return userStatsDoc.data() as UserStats;
    }
    
    // Create default user stats if they don't exist
    const defaultStats: UserStats = {
      userId,
      totalXP: 0,
      todayXP: 0,
      streakCount: 0,
      lastActive: dateToTimestamp(new Date()),
      bestDay: '',
      bestDayXP: 0,
      weeklyXPGoal: DEFAULT_WEEKLY_XP_GOAL,
      lastReset: dateToTimestamp(new Date()),
    };
    
    await setDoc(userStatsRef, defaultStats);
    return defaultStats;
  } catch (error) {
    console.error('Error getting user stats:', error);
    throw error;
  }
};

/**
 * Subscribe to user stats
 */
export const subscribeToUserStats = (
  onNext: (stats: UserStats) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  try {
    const userId = getCurrentUserId();
    const userStatsRef = doc(FIREBASE_DB, 'users', userId);
    
    return onSnapshot(userStatsRef, async (snapshot) => {
      if (snapshot.exists()) {
        onNext(snapshot.data() as UserStats);
      } else {
        // Create default user stats if they don't exist
        try {
          const defaultStats = await getUserStats();
          onNext(defaultStats);
        } catch (error) {
          if (onError) onError(error as Error);
        }
      }
    }, (error) => {
      console.error('Error in user stats listener:', error);
      if (onError) onError(error as Error);
    });
  } catch (error) {
    console.error('Error setting up user stats listener:', error);
    if (onError) onError(error as Error);
    return () => {}; // Return empty unsubscribe function
  }
};

/**
 * Update user weekly XP goal
 */
export const updateWeeklyXPGoal = async (goal: number): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const userStatsRef = doc(FIREBASE_DB, 'users', userId);
    await updateDoc(userStatsRef, {
      weeklyXPGoal: goal,
    });
  } catch (error) {
    console.error('Error updating weekly XP goal:', error);
    throw error;
  }
};

/**
 * Reset daily tasks and update stats
 * 
 * This function now only resets recurring tasks, preserving non-recurring completed tasks
 * to ensure they don't reappear in the task list on subsequent days and their XP is preserved.
 */
export const resetDailyTasks = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const now = new Date();
    const todayStr = formatDateString(now);
    
    // Get user stats to check last reset
    const userStatsRef = doc(FIREBASE_DB, 'users', userId);
    const userStatsDoc = await getDoc(userStatsRef);
    
    if (!userStatsDoc.exists()) {
      return; // No user stats, nothing to reset
    }
    
    const userStats = userStatsDoc.data() as UserStats;
    const lastResetDate = userStats.lastReset.toDate();
    const lastResetStr = formatDateString(lastResetDate);
    
    // Only reset if it's a new day
    if (lastResetStr === todayStr) {
      return; // Already reset today
    }
    
    // Use the user-specific collection instead of the legacy collection
    // to avoid permission issues
    const userTasksRef = collection(FIREBASE_DB, 'users', userId, 'tasks');
    const q = query(
      userTasksRef,
      where('recurring', '==', true), // Only reset recurring tasks
      where('completed', '==', true)
    );
    const querySnapshot = await getDocs(q);
    
    // Reset tasks in a batch
    const batch = writeBatch(FIREBASE_DB);
    querySnapshot.forEach((doc) => {
      const taskData = doc.data() as Task;
      
      // Update the task in the user-specific collection
      batch.update(doc.ref, {
        completed: false,
        completedAt: null,
        // Store the last completed date for streak tracking
        lastCompletedDate: todayStr
      });
      
      // Only update the legacy collection if we're not disabling legacy access
      // Since DISABLE_LEGACY_TASKS_ACCESS is set to true by default, this block will usually be skipped
      if (!DISABLE_LEGACY_TASKS_ACCESS) {
        try {
          if (taskData.id) {
            const legacyTaskRef = doc(FIREBASE_DB, 'tasks', taskData.id);
            // Update the legacy task in the same batch
            // This is safe because we've already set DISABLE_LEGACY_TASKS_ACCESS to true by default
            // so this code path is unlikely to be executed
            batch.update(legacyTaskRef, {
              completed: false,
              completedAt: null,
              lastCompletedDate: todayStr
            });
          }
        } catch (legacyError) {
          // This won't affect the main operation
          console.warn(`Skipping legacy update for task ${taskData.id}: ${legacyError instanceof Error ? legacyError.message : 'Unknown error'}`);
        }
      }
    });
    
    // Reset user stats for the new day
    batch.update(userStatsRef, {
      todayXP: 0,
      lastReset: dateToTimestamp(now),
    });
    
    await batch.commit();
    
    console.log(`Daily reset completed: Reset ${querySnapshot.size} recurring tasks`);
  } catch (error) {
    console.error('Error resetting daily tasks:', error);
    throw error;
  }
};
