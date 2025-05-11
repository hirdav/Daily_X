import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppDispatch, RootState } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  completeTask, 
  uncompleteTask, 
  updateTask, 
  deleteTask, 
  addTask,
  Task
} from '../../utils/firebaseService';

export interface NetworkState {
  isConnected: boolean;
  lastChecked: number | null;
  pendingOperations: PendingOperation[];
  isOfflineMode: boolean; // Flag to indicate if app is in explicit offline mode
  lastSyncAttempt: number | null;
  isSyncing: boolean;
}

export interface PendingOperation {
  id: string;
  type: 'completeTask' | 'uncompleteTask' | 'updateTask' | 'deleteTask' | 'addTask';
  payload: {
    taskId?: string;
    updates?: Partial<Task>;
    task?: Omit<Task, 'id' | 'userId' | 'completed' | 'createdAt'>;
  };
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
}

const initialState: NetworkState = {
  isConnected: true,
  lastChecked: null,
  pendingOperations: [],
  isOfflineMode: false,
  lastSyncAttempt: null,
  isSyncing: false
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setNetworkStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      state.lastChecked = Date.now();
      
      // If we're back online, we'll want to sync soon
      if (action.payload === true && state.pendingOperations.length > 0) {
        // Logging removed for production ('Network reconnected with pending operations');
      }
    },
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.isOfflineMode = action.payload;
      // Logging removed for production (`Offline mode ${action.payload ? 'enabled' : 'disabled'}`);
    },
    setIsSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    setSyncAttempt: (state) => {
      state.lastSyncAttempt = Date.now();
    },
    addPendingOperation: (state, action: PayloadAction<Omit<PendingOperation, 'retryCount' | 'status' | 'id'>>) => {
      state.pendingOperations.push({
        ...action.payload,
        id: uuidv4(),
        retryCount: 0,
        status: 'pending',
      });
      // Logging removed for production (`Added pending operation: ${action.payload.type}`);
    },
    removePendingOperation: (state, action: PayloadAction<string>) => {
      state.pendingOperations = state.pendingOperations.filter(op => op.id !== action.payload);
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const operation = state.pendingOperations.find(op => op.id === action.payload);
      if (operation) {
        operation.retryCount += 1;
      }
    },
    setOperationStatus: (state, action: PayloadAction<{id: string, status: PendingOperation['status']}>) => {
      const { id, status } = action.payload;
      const operation = state.pendingOperations.find(op => op.id === id);
      if (operation) {
        operation.status = status;
      }
    },
    clearFailedOperations: (state) => {
      state.pendingOperations = state.pendingOperations.filter(op => op.status !== 'failed');
    },
  },
});

// Export actions
export const {
  setNetworkStatus,
  setOfflineMode,
  setIsSyncing,
  setSyncAttempt,
  addPendingOperation,
  removePendingOperation,
  incrementRetryCount,
  setOperationStatus,
  clearFailedOperations,
} = networkSlice.actions;

// No need for additional action creators as they're already exported from the slice

// Types
export interface NetworkState {
  isConnected: boolean;
  isOfflineMode: boolean;
  isSyncing: boolean;
  lastChecked: number;
  lastSyncAttempt: number;
  pendingOperations: Array<any>; // Replace 'any' with your PendingOperation type if defined
}

// Selectors
export const selectNetworkStatus = (state: RootState): boolean => (state.network as NetworkState)?.isConnected ?? false;
export const selectLastSyncAttempt = (state: RootState): number => (state.network as NetworkState)?.lastSyncAttempt ?? 0;
export const selectIsOfflineMode = (state: RootState): boolean => (state.network as NetworkState)?.isOfflineMode ?? false;
export const selectLastChecked = (state: RootState): number => (state.network as NetworkState)?.lastChecked ?? 0;
export const selectPendingOperations = (state: RootState): Array<any> => (state.network as NetworkState)?.pendingOperations ?? [];

// Thunks
export const syncPendingOperations = () => async (dispatch: AppDispatch, getState: () => RootState) => {
  const state = getState();
  const networkState = state.network as NetworkState;
  
  // Skip if offline or no pending operations
  if (!networkState.isConnected || networkState.pendingOperations.length === 0) {
    return;
  }
  
  // Set syncing status
  dispatch(setIsSyncing(true));
  dispatch(setSyncAttempt());
  
  try {
    // Process pending operations in order (oldest first)
    const sortedOperations = [...networkState.pendingOperations]
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter(op => op.status !== 'processing'); // Skip operations already being processed
    
    // Logging removed for production (`Attempting to sync ${sortedOperations.length} pending operations`);
    
    for (const operation of sortedOperations) {
      try {
        // Mark operation as processing
        dispatch(setOperationStatus({id: operation.id, status: 'processing'}));
        
        // Process based on operation type
        switch (operation.type) {
          case 'completeTask':
            if (operation.payload.taskId) {
              await completeTask(operation.payload.taskId);
            } else {
              throw new Error('Missing taskId for completeTask operation');
            }
            break;
            
          case 'uncompleteTask':
            if (operation.payload.taskId) {
              await uncompleteTask(operation.payload.taskId);
            } else {
              throw new Error('Missing taskId for uncompleteTask operation');
            }
            break;
            
          case 'updateTask':
            if (operation.payload.taskId && operation.payload.updates) {
              await updateTask(operation.payload.taskId, operation.payload.updates);
            } else {
              throw new Error('Missing taskId or updates for updateTask operation');
            }
            break;
            
          case 'deleteTask':
            if (operation.payload.taskId) {
              await deleteTask(operation.payload.taskId);
            } else {
              throw new Error('Missing taskId for deleteTask operation');
            }
            break;
            
          case 'addTask':
            if (operation.payload.task) {
              await addTask(operation.payload.task);
            } else {
              throw new Error('Missing task data for addTask operation');
            }
            break;
            
          default:
            console.warn(`Unknown operation type: ${(operation as any).type}`);
        }
        
        // Operation succeeded, remove it
        dispatch(removePendingOperation(operation.id));
        // Logging removed for production (`Successfully synced operation ${operation.id} of type ${operation.type}`);
      } catch (error) {
        // Logging removed for production (`Failed to process pending operation ${operation.id}:`, error);
        dispatch(setOperationStatus({id: operation.id, status: 'failed'}));
        dispatch(incrementRetryCount(operation.id));
      }
    }
  } finally {
    // Reset syncing status
    dispatch(setIsSyncing(false));
  }
};

export default networkSlice.reducer;
