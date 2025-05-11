import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';


// Import reducers
// Use dynamic imports to avoid TypeScript errors with circular dependencies
const tasksReducer = require('./slices/tasksSlice').default;
const xpReducer = require('./slices/xpSlice').default;
const userStatsReducer = require('./slices/userStatsSlice').default;
const networkReducer = require('./slices/networkSlice').default;

// Configure persist options
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  // Don't persist network status
  blacklist: ['network'],
};

// Combine all reducers
export const rootReducer = combineReducers({
  tasks: tasksReducer,
  xp: xpReducer,
  userStats: userStatsReducer,
  network: networkReducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'persist/PERSIST', 
          'persist/REHYDRATE'
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: [
          'meta.arg', 
          'payload.timestamp',
          'payload.created',
          'payload.lastUpdated',
          'payload.completedAt',
          'payload.lastActive',
          'payload.lastReset',
          'payload.timestamp',
          'payload.previousState',
          'payload.updates',
          // Handle array items with timestamps
          'payload.0.created',
          'payload.0.lastUpdated',
          'payload.0.completedAt',
          'payload.0.timestamp',
          // Handle nested objects
          'payload.0.previousState.completedAt',
          'payload.0.previousState.created',
          'payload.0.previousState.lastUpdated',
          'payload.0.previousState.timestamp',
          'payload.0.updates.completedAt',
          'payload.0.updates.created',
          'payload.0.updates.lastUpdated',
          'payload.0.updates.timestamp',
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'tasks.entities',
          'xp.dailyXpBank',
          'userStats.data'
        ],
      },
    }),
});

// Create persistor
export const persistor = persistStore(store);

// Export types for use in selectors and components
export type RootState = ReturnType<typeof store.getState>;

// Export the dispatch type for use in components
export type AppDispatch = typeof store.dispatch;

