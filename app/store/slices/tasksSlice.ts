import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  subscribeToTasks, 
  completeTask, 
  uncompleteTask, 
  addTask, 
  updateTask, 
  deleteTask,
  Task,
  getCurrentUserId,
  resetRecurringTasks
} from '../../utils/firebaseService';
import { addPendingOperation, NetworkState } from './networkSlice';
import { RootState, AppDispatch } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface TasksState {
  items: Task[];
  loading: boolean;
  error: string | null;
  lastSynced: number | null;
}

const initialState: TasksState = {
  items: [],
  loading: false,
  error: null,
  lastSynced: null,
};

// Async thunks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      // First reset any recurring tasks from previous days
      await dispatch(resetRecurringTasksAsync());
      
      return new Promise<Task[]>((resolve, reject) => {
        const unsubscribe = subscribeToTasks(
          (tasks) => {
            unsubscribe(); // Unsubscribe after getting data
            resolve(tasks);
          },
          (error) => {
            reject(rejectWithValue(error.message));
          }
        );
      });
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// Reset recurring tasks that were completed on previous days
export const resetRecurringTasksAsync = createAsyncThunk(
  'tasks/resetRecurringTasks',
  async (_, { rejectWithValue }) => {
    try {
      const result = await resetRecurringTasks();
      
      if (!result.success) {
        console.warn('Failed to reset recurring tasks:', result.message);
        return rejectWithValue(result.message || 'Failed to reset recurring tasks');
      }
      
      return result;
    } catch (error) {
      console.error('Error resetting recurring tasks:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const completeTaskAsync = createAsyncThunk(
  'tasks/completeTask',
  async (taskId: string, { dispatch, rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const networkState = state.network as NetworkState;
      
      // If offline or in explicit offline mode, add to pending operations
      if (!networkState.isConnected || networkState.isOfflineMode) {
        // Optimistically update the UI immediately
        dispatch(optimisticallyCompleteTask(taskId));
        
        // Queue the operation for later sync
        dispatch(addPendingOperation({
          type: 'completeTask',
          payload: { taskId },
          timestamp: Date.now(),
        }));
        
        console.log(`Task ${taskId} marked as complete (offline mode). Will sync later.`);
        return { taskId, success: true, offlineMode: true };
      }
      
      // If online, proceed normally
      const result = await completeTask(taskId);
      
      if (!result.success) {
        return rejectWithValue(result.message || 'Failed to complete task');
      }
      
      // Return detailed information about the task completion
      return { 
        taskId, 
        success: true,
        awardedXP: result.awardedXP,
        originalXp: result.originalXp,
        xpCapped: result.xpCapped,
        message: result.message
      };
    } catch (error) {
      console.error('Error completing task:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const uncompleteTaskAsync = createAsyncThunk(
  'tasks/uncompleteTask',
  async (taskId: string, { dispatch, rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const networkState = state.network as NetworkState;
      
      // If offline or in explicit offline mode, add to pending operations
      if (!networkState.isConnected || networkState.isOfflineMode) {
        // Optimistically update the UI immediately
        dispatch(optimisticallyUncompleteTask(taskId));
        
        // Queue the operation for later sync
        dispatch(addPendingOperation({
          type: 'uncompleteTask',
          payload: { taskId },
          timestamp: Date.now(),
        }));
        
        console.log(`Task ${taskId} marked as uncomplete (offline mode). Will sync later.`);
        return { taskId, success: true, offlineMode: true };
      }
      
      // If online, proceed normally
      const result = await uncompleteTask(taskId);
      
      if (!result.success) {
        return rejectWithValue(result.message || 'Failed to uncomplete task');
      }
      
      return { taskId, success: true };
    } catch (error) {
      console.error('Error uncompleting task:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const addTaskAsync = createAsyncThunk(
  'tasks/addTask',
  async (task: Omit<Task, 'id' | 'userId' | 'completed' | 'createdAt'>, { dispatch, rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const networkState = state.network as NetworkState;
      
      // If offline or in explicit offline mode, add to pending operations
      if (!networkState.isConnected || networkState.isOfflineMode) {
        // For new tasks, we need to generate a temporary ID
        const tempId = `temp_${uuidv4()}`;
        const tempTask: Task = {
          ...task,
          id: tempId,
          userId: getCurrentUserId(),
          completed: false,
          createdAt: { toDate: () => new Date() } as any,
          isPending: true,
          syncStatus: "pending" as "pending",
        };
        
        // Queue the operation for later sync
        dispatch(addPendingOperation({
          type: 'addTask',
          payload: { task }, // Store the original task data without the temp ID
          timestamp: Date.now(),
        }));
        
        // Optimistically add to the UI
        const tasksState = state.tasks as TasksState;
        dispatch(setTasks([...tasksState.items, tempTask]));
        console.log(`Task created (offline mode). Will sync later. Temp ID: ${tempId}`);
        return { task: tempTask, success: true, offlineMode: true, tempId };
      }
      
      // If online, proceed normally
      const result = await addTask(task);
      
      if (!result.success) {
        return rejectWithValue(result.message || 'Failed to add task');
      }
      
      if (result.taskId) {
        return { taskId: result.taskId, success: true };
      } else {
        return rejectWithValue('Task created but no ID was returned');
      }
    } catch (error) {
      console.error('Error adding task:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const updateTaskAsync = createAsyncThunk(
  'tasks/updateTask',
  async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }, { dispatch, rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const networkState = state.network as NetworkState;
      
      // If offline or in explicit offline mode, add to pending operations
      if (!networkState.isConnected || networkState.isOfflineMode) {
        // Create a temporary task object with the updates applied
        const tasksState = state.tasks as TasksState;
        const task = tasksState.items.find(t => t.id === taskId);
        
        if (!task) {
          return rejectWithValue('Task not found');
        }
        
        // Queue the operation for later sync
        dispatch(addPendingOperation({
          type: 'updateTask',
          payload: { taskId, updates },
          timestamp: Date.now(),
        }));
        
        // Optimistically update the UI
        // This will be handled by the reducer
        console.log(`Task ${taskId} updated (offline mode). Will sync later.`);
        return { taskId, updates, success: true, offlineMode: true };
      }
      
      // If online, proceed normally
      const result = await updateTask(taskId, updates);
      
      if (!result.success) {
        return rejectWithValue(result.message || 'Failed to update task');
      }
      
      return { taskId, updates, success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const deleteTaskAsync = createAsyncThunk(
  'tasks/deleteTask',
  async (taskId: string, { dispatch, rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const networkState = state.network as NetworkState;
      
      // If offline or in explicit offline mode, add to pending operations
      if (!networkState.isConnected || networkState.isOfflineMode) {
        // Queue the operation for later sync
        dispatch(addPendingOperation({
          type: 'deleteTask',
          payload: { taskId },
          timestamp: Date.now(),
        }));
        
        // Optimistically update the UI - the reducer will handle this
        console.log(`Task ${taskId} deleted (offline mode). Will sync later.`);
        return { taskId, success: true, offlineMode: true };
      }
      
      // If online, proceed normally
      const result = await deleteTask(taskId);
      
      if (!result.success) {
        return rejectWithValue(result.message || 'Failed to delete task');
      }
      
      return { taskId, success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

// Create the slice
export const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setTasks: (state, action: PayloadAction<Task[]>) => {
      state.items = action.payload;
      state.lastSynced = Date.now();
    },
    // For optimistic updates when offline
    optimisticallyCompleteTask: (state, action: PayloadAction<string>) => {
      const task = state.items.find(t => t.id === action.payload);
      if (task) {
        task.completed = true;
        task.completedAt = { toDate: () => new Date() } as any;
        task.isPending = true;
      }
    },
    optimisticallyUncompleteTask: (state, action: PayloadAction<string>) => {
      const task = state.items.find(t => t.id === action.payload);
      if (task) {
        task.completed = false;
        task.completedAt = null;
        task.isPending = true;
      }
    },
    clearTaskErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch tasks
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.lastSynced = Date.now();
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Complete task
      .addCase(completeTaskAsync.fulfilled, (state, action) => {
        const task = state.items.find(t => t.id === action.payload.taskId);
        if (task) {
          task.completed = true;
          task.completedAt = { toDate: () => new Date() } as any;
          task.isPending = false;
        }
      })
      
      // Uncomplete task
      .addCase(uncompleteTaskAsync.fulfilled, (state, action) => {
        const task = state.items.find(t => t.id === action.payload.taskId);
        if (task) {
          task.completed = false;
          task.completedAt = null;
          task.isPending = false;
        }
      })
      
      // Add task
      .addCase(addTaskAsync.fulfilled, (state: TasksState, action: PayloadAction<any>) => {
        state.items = state.items.filter((t: Task) => !t.isPending);

        if (action.payload.offlineMode && action.payload.task) {
          // Add the offline-created task (already a Task)
          state.items.push({ ...action.payload.task, isPending: false, syncStatus: "synced" as "synced" });
        } else if (action.payload.taskId && action.payload.task) {
          // Add the online-created task (ensure all Task fields are present)
          const newTask: Task = {
            ...action.payload.task,
            id: action.payload.taskId,
            isPending: false,
            syncStatus: "synced" as "synced"
          };
          state.items.push(newTask);
        }
      })

      // Update task
      .addCase(updateTaskAsync.fulfilled, (state: TasksState, action: PayloadAction<any>) => {
        const task = state.items.find(t => t.id === action.payload.taskId);
        if (task) {
          Object.assign(task, action.payload.updates);
          task.isPending = false;
        }
      })
      
      // Delete task
      .addCase(deleteTaskAsync.fulfilled, (state: TasksState, action: PayloadAction<any>) => {
        state.items = state.items.filter((t: Task) => t.id !== action.payload.taskId);
      });
  },
});

// Export actions
export const { 
  setTasks, 
  optimisticallyCompleteTask, 
  optimisticallyUncompleteTask,
  clearTaskErrors
} = tasksSlice.actions;

// Export selectors (robust to only valid Task objects)
export const selectAllTasks = (state: RootState): Task[] =>
  state.tasks.items.filter((task: any) => !!task && typeof task.id === 'string');
export const selectCompletedTasks = (state: RootState): Task[] =>
  state.tasks.items.filter((task: any) => !!task && task.completed);
export const selectIncompleteTasks = (state: RootState): Task[] =>
  state.tasks.items.filter((task: any) => !!task && !task.completed);
export const selectTaskById = (state: RootState, taskId: string): Task | undefined =>
  state.tasks.items.find((task: any) => !!task && task.id === taskId);
export const selectTasksLoading = (state: RootState): boolean => state.tasks.loading;
export const selectTasksError = (state: RootState): string | null => state.tasks.error;

export default tasksSlice.reducer;
