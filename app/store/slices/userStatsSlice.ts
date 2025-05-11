import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  getUserStats, 
  subscribeToUserStats
} from '../../utils/firebaseService';
import { UserStats } from '../../types';
import { RootState, AppDispatch } from '../types';

interface UserStatsState {
  data: UserStats | null;
  loading: boolean;
  error: string | null;
  lastSynced: number | null;
}

const initialState: UserStatsState = {
  data: null,
  loading: false,
  error: null,
  lastSynced: null,
};

// Async thunks
export const fetchUserStats = createAsyncThunk(
  'userStats/fetchUserStats',
  async (_, { rejectWithValue }) => {
    try {
      const stats = await getUserStats();
      return stats;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const subscribeToUserStatsAsync = createAsyncThunk(
  'userStats/subscribeToUserStats',
  async (_, { dispatch, rejectWithValue }) => {
    return new Promise<UserStats>((resolve, reject) => {
      const unsubscribe = subscribeToUserStats(
        (stats) => {
          if (stats) {
            dispatch(setUserStats(stats));
            resolve(stats);
          }
        },
        (error) => {
          reject(rejectWithValue(error.message));
        }
      );
      
      // Return the unsubscribe function
      return unsubscribe;
    });
  }
);

// Create the slice
export const userStatsSlice = createSlice({
  name: 'userStats',
  initialState,
  reducers: {
    setUserStats: (state, action: PayloadAction<UserStats>) => {
      state.data = action.payload;
      state.lastSynced = Date.now();
    },
    updateLocalUserStats: (state, action: PayloadAction<Partial<UserStats>>) => {
      if (state.data) {
        state.data = { ...state.data, ...action.payload };
      }
    },
    clearUserStatsErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user stats
      .addCase(fetchUserStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastSynced = Date.now();
      })
      .addCase(fetchUserStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const { 
  setUserStats, 
  updateLocalUserStats,
  clearUserStatsErrors
} = userStatsSlice.actions;

// Export selectors
export const selectUserStats = (state: RootState): UserStats | null => state.userStats.data;
export const selectTotalXP = (state: RootState): number => state.userStats.data?.totalXP || 0;
export const selectTodayXP = (state: RootState): number => state.userStats.data?.todayXP || 0;
export const selectStreakCount = (state: RootState): number => state.userStats.data?.streakCount || 0;
export const selectUserStatsLoading = (state: RootState): boolean => state.userStats.loading;
export const selectUserStatsError = (state: RootState): string | null => state.userStats.error;

export default userStatsSlice.reducer;
