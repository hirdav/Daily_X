import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { FIREBASE_DB, FIREBASE_AUTH } from '../../FirebaseConfig';
import { ScheduledTask } from '../types/scheduledTask';
import { formatDateString } from './dateUtils';
import * as Notifications from 'expo-notifications';

/**
 * Get the current user ID or throw an error if not logged in
 */
const getCurrentUserId = (): string => {
  const user = FIREBASE_AUTH.currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.uid;
};

/**
 * Add a new scheduled task
 */
export const addScheduledTask = async (
  task: Omit<ScheduledTask, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<{ success: boolean; message?: string; taskId?: string; }> => {
  try {
    const userId = getCurrentUserId();
    
    // Create the task object, removing any undefined values
    const taskData: Record<string, any> = {
      title: task.title,
      description: task.description || null, // Convert undefined to null
      scheduledDate: task.scheduledDate,
      repeatFrequency: task.repeatFrequency,
      notificationEnabled: task.notificationEnabled,
    };
    
    // Only add scheduledTime if it exists
    if (task.scheduledTime) {
      taskData.scheduledTime = task.scheduledTime;
    }
    
    // Add dueDate if it exists
    if (task.dueDate) {
      taskData.dueDate = task.dueDate;
      console.log(`Adding task with due date: ${task.dueDate}`);
    }
    
    // Create the final task object
    const newTask = {
      ...taskData,
      userId,
      status: 'upcoming' as const,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    
    // Add to Firestore
    const taskRef = collection(FIREBASE_DB, `users/${userId}/scheduledTasks`);
    const docRef = await addDoc(taskRef, newTask);
    
    // Schedule notification if enabled
    if (task.notificationEnabled) {
      const notificationId = await scheduleTaskNotification({
        ...newTask,
        id: docRef.id
      } as ScheduledTask);
      
      // Update the task with the notification ID
      if (notificationId) {
        await updateDoc(docRef, {
          notificationId
        });
      }
    }
    
    return { 
      success: true, 
      taskId: docRef.id,
      message: 'Scheduled task created successfully'
    };
  } catch (error) {
    console.error('Error adding scheduled task:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Update an existing scheduled task
 */
export const updateScheduledTask = async (
  taskId: string,
  updates: Partial<Omit<ScheduledTask, 'id' | 'userId' | 'createdAt'>>
): Promise<{ success: boolean; message?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const taskRef = doc(FIREBASE_DB, `users/${userId}/scheduledTasks/${taskId}`);
    
    // Get the current task to check notification settings
    const taskSnapshot = await getDocs(query(
      collection(FIREBASE_DB, `users/${userId}/scheduledTasks`),
      where('__name__', '==', taskId)
    ));
    
    if (taskSnapshot.empty) {
      return { success: false, message: 'Task not found' };
    }
    
    const currentTask = { 
      id: taskSnapshot.docs[0].id, 
      ...taskSnapshot.docs[0].data() 
    } as ScheduledTask;
    
    // Cancel existing notification if it exists
    if (currentTask.notificationId) {
      await cancelTaskNotification(currentTask.notificationId);
    }
    
    // Create a clean update object without undefined values
    const cleanUpdates: Record<string, any> = {
      updatedAt: serverTimestamp() as Timestamp
    };
    
    // Add title if provided
    if (updates.title !== undefined) {
      cleanUpdates.title = updates.title;
    }
    
    // Add description if provided (convert undefined to null)
    if (updates.description !== undefined) {
      cleanUpdates.description = updates.description || null;
    }
    
    // Add scheduledDate if provided
    if (updates.scheduledDate !== undefined) {
      cleanUpdates.scheduledDate = updates.scheduledDate;
    }
    
    // Add scheduledTime if provided (don't include if undefined)
    if (updates.scheduledTime !== undefined) {
      cleanUpdates.scheduledTime = updates.scheduledTime || null;
    }
    
    // Add dueDate if provided
    if (updates.dueDate !== undefined) {
      cleanUpdates.dueDate = updates.dueDate || null;
      console.log(`Updating task with due date: ${updates.dueDate}`);
    }
    
    // Add other fields if provided
    if (updates.repeatFrequency !== undefined) {
      cleanUpdates.repeatFrequency = updates.repeatFrequency;
    }
    
    if (updates.notificationEnabled !== undefined) {
      cleanUpdates.notificationEnabled = updates.notificationEnabled;
    }
    
    if (updates.status !== undefined) {
      cleanUpdates.status = updates.status;
    }
    
    // Update the task
    await updateDoc(taskRef, cleanUpdates);
    
    // Schedule new notification if enabled
    if (updates.notificationEnabled !== false && 
        (updates.notificationEnabled || currentTask.notificationEnabled)) {
      const mergedTask = { ...currentTask, ...updates };
      const notificationId = await scheduleTaskNotification(mergedTask);
      
      // Update the task with the new notification ID
      if (notificationId) {
        await updateDoc(taskRef, { notificationId });
      }
    }
    
    return { success: true, message: 'Scheduled task updated successfully' };
  } catch (error) {
    console.error('Error updating scheduled task:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Delete a scheduled task
 */
export const deleteScheduledTask = async (
  taskId: string
): Promise<{ success: boolean; message?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const taskRef = doc(FIREBASE_DB, `users/${userId}/scheduledTasks/${taskId}`);
    
    // Get the task to check for notification ID
    const taskSnapshot = await getDocs(query(
      collection(FIREBASE_DB, `users/${userId}/scheduledTasks`),
      where('__name__', '==', taskId)
    ));
    
    if (!taskSnapshot.empty) {
      const task = taskSnapshot.docs[0].data() as ScheduledTask;
      
      // Cancel notification if it exists
      if (task.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(task.notificationId);
      }
    }
    
    // Delete the task
    await deleteDoc(taskRef);
    
    return { success: true, message: 'Scheduled task deleted successfully' };
  } catch (error) {
    console.error('Error deleting scheduled task:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Update a scheduled task's status
 */
export const updateScheduledTaskStatus = async (
  taskId: string,
  status: 'upcoming' | 'completed' | 'missed'
): Promise<{ success: boolean; message?: string; }> => {
  try {
    const userId = getCurrentUserId();
    const taskRef = doc(FIREBASE_DB, `users/${userId}/scheduledTasks/${taskId}`);
    
    await updateDoc(taskRef, {
      status,
      updatedAt: serverTimestamp()
    });
    
    return { success: true, message: `Task marked as ${status}` };
  } catch (error) {
    console.error(`Error updating task status to ${status}:`, error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * Subscribe to scheduled tasks with filtering options
 * 
 * This implementation avoids the need for a composite index by using
 * client-side filtering instead of compound queries.
 */
export const subscribeToScheduledTasks = (
  callback: (tasks: ScheduledTask[]) => void,
  filters?: {
    status?: ('upcoming' | 'completed' | 'missed')[];
    fromDate?: Date;
    toDate?: Date;
  }
): Unsubscribe => {
  const userId = getCurrentUserId();
  const tasksRef = collection(FIREBASE_DB, `users/${userId}/scheduledTasks`);
  
  // Create a simple query without compound conditions to avoid index requirements
  let q = query(tasksRef);
  
  // Subscribe to the query
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ScheduledTask[];
    
    // Apply all filters client-side
    let filteredTasks = tasks;
    
    // Apply status filter
    if (filters?.status && filters.status.length > 0) {
      filteredTasks = filteredTasks.filter(task => 
        filters.status!.includes(task.status)
      );
    }
    
    // Apply date range filters
    if (filters?.fromDate) {
      filteredTasks = filteredTasks.filter(task => 
        new Date(task.scheduledDate) >= filters.fromDate!
      );
    }
    if (filters?.toDate) {
      filteredTasks = filteredTasks.filter(task => 
        new Date(task.scheduledDate) <= filters.toDate!
      );
    }
    
    // Sort by scheduled date (client-side sorting)
    filteredTasks.sort((a, b) => {
      return a.scheduledDate.localeCompare(b.scheduledDate);
    });
    
    callback(filteredTasks);
  });
};

/**
 * Check for missed scheduled tasks and update their status
 * 
 * This implementation avoids the need for a composite index by using
 * client-side filtering instead of a compound query.
 */
export const checkForMissedTasks = async (): Promise<number> => {
  try {
    const userId = getCurrentUserId();
    const today = formatDateString(new Date());
    
    // Get all upcoming tasks - using only a single where clause to avoid index requirements
    const tasksRef = collection(FIREBASE_DB, `users/${userId}/scheduledTasks`);
    const q = query(
      tasksRef,
      where('status', '==', 'upcoming')
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    
    // Filter tasks with dates before today client-side
    const missedTasks = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.scheduledDate < today;
    });
    
    if (missedTasks.length === 0) return 0;
    
    // Update all missed tasks in a batch
    const batch = writeBatch(FIREBASE_DB);
    missedTasks.forEach(doc => {
      batch.update(doc.ref, {
        status: 'missed',
        updatedAt: serverTimestamp()
      });
    });
    
    await batch.commit();
    return missedTasks.length;
  } catch (error) {
    console.error('Error checking for missed tasks:', error);
    return 0;
  }
};

/**
 * Schedule a notification for a task
 * 
 * Note: This is a simplified implementation that returns a mock notification ID.
 * In a production app, you would integrate with a proper notification system.
 */
export const scheduleTaskNotification = async (
  task: ScheduledTask
): Promise<string | null> => {
  if (!task.notificationEnabled) return null;
  
  try {
    // Parse the scheduled date and time
    const scheduledDate = new Date(task.scheduledDate);
    
    // If time is provided, set it on the scheduled date
    if (task.scheduledTime) {
      const [hours, minutes] = task.scheduledTime.split(':').map(Number);
      scheduledDate.setHours(hours, minutes, 0, 0);
    } else {
      // Default to 9:00 AM for all-day tasks
      scheduledDate.setHours(9, 0, 0, 0);
    }
    
    // Only schedule if the date is in the future
    if (scheduledDate <= new Date()) {
      console.log('Task date is in the past, not scheduling notification');
      return null;
    }
    
    // In a real implementation, you would use the proper notification API
    // For now, we'll just log the notification and return a mock ID
    console.log(`Notification scheduled for ${task.title} at ${scheduledDate.toLocaleString()}`);
    
    // Generate a mock notification ID
    const mockNotificationId = `notification_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return mockNotificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

/**
 * Cancel a scheduled notification
 * 
 * Note: This is a simplified implementation that just logs the cancellation.
 * In a production app, you would integrate with a proper notification system.
 */
export const cancelTaskNotification = async (
  notificationId: string
): Promise<boolean> => {
  try {
    // In a real implementation, you would use the proper notification API
    // For now, we'll just log the cancellation
    console.log(`Notification canceled: ${notificationId}`);
    return true;
  } catch (error) {
    console.error('Error canceling notification:', error);
    return false;
  }
};
