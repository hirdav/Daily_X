import { Task } from './firebaseService';
import { formatDateString } from './dateUtils';

// Interface for missed task occurrences
export interface MissedTaskOccurrence {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  category?: string;
  xp: number;
  date: string;  // The specific date this task was missed
  userId: string;
  action: 'incomplete';
  recurring?: boolean;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  timestamp: any;
}

/**
 * Generate missed occurrences for a task
 * 
 * For recurring tasks:
 * - Generate an occurrence for each day since creation (or last reset) that the task wasn't completed
 * 
 * For non-recurring tasks:
 * - Generate an occurrence if the task wasn't completed by its due date
 * 
 * @param task The task to generate missed occurrences for
 * @returns Array of missed task occurrences
 */
export const generateMissedOccurrences = (task: Task): MissedTaskOccurrence[] => {
  const missedOccurrences: MissedTaskOccurrence[] = [];
  const today = new Date();
  const todayStr = formatDateString(today);
  
  // If task is completed and not recurring, it can't have missed occurrences
  if (task.completed && !task.recurring) {
    return [];
  }
  
  if (task.recurring) {
    // For recurring tasks, we need to generate missed occurrences for each day
    // since the task was created (or last reset) that it wasn't completed
    
    // Get task creation date
    const creationDate = task.createdAt ? new Date(task.createdAt.toDate()) : new Date();
    const startDate = new Date(creationDate);
    
    // Loop through each day from creation to yesterday
    const currentDate = new Date(startDate);
    while (formatDateString(currentDate) < todayStr) {
      const dateStr = formatDateString(currentDate);
      
      // If the task wasn't completed on this date, add a missed occurrence
      // We check if lastCompletedDate is different from the current date
      if (!task.lastCompletedDate || task.lastCompletedDate !== dateStr) {
        missedOccurrences.push({
          id: `missed_${task.id}_${dateStr}`,
          taskId: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          xp: task.xp,
          date: dateStr,
          userId: task.userId,
          action: 'incomplete',
          recurring: task.recurring,
          subtasks: task.subtasks?.map(subtask => ({
            id: subtask.id,
            title: subtask.title,
            completed: subtask.completed
          })),
          timestamp: new Date(currentDate)
        });
      }
      
      // Move to the next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    // For non-recurring tasks, we only generate a missed occurrence if:
    // 1. The task is not completed
    // 2. The task has a due date
    // 3. The due date has passed
    
    if (!task.completed && task.completedAt) {
      const dueDate = new Date(task.completedAt.toDate());
      const dueDateStr = formatDateString(dueDate);
      
      if (dueDateStr < todayStr) {
        // The task was due in the past and wasn't completed
        missedOccurrences.push({
          id: `missed_${task.id}_${dueDateStr}`,
          taskId: task.id,
          title: task.title,
          description: task.description,
          category: task.category,
          xp: task.xp,
          date: dueDateStr,
          userId: task.userId,
          action: 'incomplete',
          recurring: task.recurring,
          subtasks: task.subtasks?.map(subtask => ({
            id: subtask.id,
            title: subtask.title,
            completed: subtask.completed
          })),
          timestamp: new Date(dueDate)
        });
      }
    }
  }
  
  return missedOccurrences;
}

/**
 * Generate all missed task occurrences for an array of tasks
 * 
 * @param tasks Array of tasks to generate missed occurrences for
 * @returns Array of all missed task occurrences
 */
export const generateAllMissedOccurrences = (tasks: Task[]): MissedTaskOccurrence[] => {
  return tasks.flatMap(task => generateMissedOccurrences(task));
}
