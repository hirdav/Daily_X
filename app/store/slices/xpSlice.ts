import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  getXPBank, 
  getXPBankRecords, 
  DailyXPBank, 
  XPBankRecord,
  subscribeToDailyStats,
  DailyStats
} from '../../utils/firebaseService';
import { addPendingOperation } from './networkSlice';
import { RootState, AppDispatch } from '../types';
import { formatDateString } from '../../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

interface XpState {
  dailyXpBank: DailyXPBank | null;
  xpRecords: XPBankRecord[];
  dailyStats: DailyStats[];
  loading: boolean;
  error: string | null;
  lastSynced: number | null;
  offlineXpAdjustments: number;
}

const initialState: XpState = {
  dailyXpBank: null,
  xpRecords: [],
  dailyStats: [],
  loading: false,
  error: null,
  lastSynced: null,
  offlineXpAdjustments: 0,
};

// Async thunks
export const fetchDailyXpBank = createAsyncThunk(
  'xp/fetchDailyXpBank',
  async (date: Date = new Date(), { rejectWithValue }) => {
    try {
      const xpBank = await getXPBank(date);
      return xpBank;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchXpRecords = createAsyncThunk(
  'xp/fetchXpRecords',
  async (date: Date = new Date(), { rejectWithValue }) => {
    try {
      const records = await getXPBankRecords(date);
      return records;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
    }
  }
);

export const fetchDailyStats = createAsyncThunk(
  'xp/fetchDailyStats',
  async (
    { startDate, endDate }: { startDate?: Date; endDate?: Date },
    { rejectWithValue }
  ) => {
    return new Promise<DailyStats[]>((resolve, reject) => {
      const unsubscribe = subscribeToDailyStats(
        startDate || null,
        endDate || null,
        (stats) => {
          unsubscribe(); // Unsubscribe after getting data
          resolve(stats);
        },
        (error) => {
          reject(rejectWithValue(error.message));
        }
      );
    });
  }
);

// Create the slice
export const xpSlice = createSlice({
  name: 'xp',
  initialState,
  reducers: {
    setDailyXpBank: (state, action: PayloadAction<DailyXPBank | null>) => {
      state.dailyXpBank = action.payload;
      state.lastSynced = Date.now();
    },
    setXpRecords: (state, action: PayloadAction<XPBankRecord[]>) => {
      state.xpRecords = action.payload;
    },
    setDailyStats: (state, action: PayloadAction<DailyStats[]>) => {
      state.dailyStats = action.payload;
    },
    // For offline XP adjustments
    addOfflineXpAdjustment: (state, action: PayloadAction<number>) => {
      state.offlineXpAdjustments += action.payload;
    },
    clearOfflineXpAdjustments: (state) => {
      state.offlineXpAdjustments = 0;
    },
    clearXpErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch daily XP bank
      .addCase(fetchDailyXpBank.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyXpBank.fulfilled, (state, action) => {
        state.loading = false;
        state.dailyXpBank = action.payload;
        state.lastSynced = Date.now();
      })
      .addCase(fetchDailyXpBank.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch XP records
      .addCase(fetchXpRecords.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchXpRecords.fulfilled, (state, action) => {
        state.loading = false;
        state.xpRecords = action.payload;
      })
      .addCase(fetchXpRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch daily stats
      .addCase(fetchDailyStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyStats.fulfilled, (state, action) => {
        state.loading = false;
        state.dailyStats = action.payload;
      })
      .addCase(fetchDailyStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Export actions
export const { 
  setDailyXpBank, 
  setXpRecords, 
  setDailyStats,
  addOfflineXpAdjustment,
  clearOfflineXpAdjustments,
  clearXpErrors
} = xpSlice.actions;

// Export selectors
export const selectDailyXpBank = (state: RootState): DailyXPBank | null => state.xp.dailyXpBank;
export const selectXpRecords = (state: RootState): XPBankRecord[] => state.xp.xpRecords;
export const selectDailyStats = (state: RootState): DailyStats[] => state.xp.dailyStats;
export const selectTodayXp = (state: RootState): number => {
  const today = formatDateString(new Date());
  const todayStat = state.xp.dailyStats.find((stat: any) => stat.date === today);
  return todayStat?.xpEarned || 0;
};
export const selectXpLoading = (state: RootState): boolean => state.xp.loading;
export const selectXpError = (state: RootState): string | null => state.xp.error;
export const selectOfflineXpAdjustments = (state: RootState): number => state.xp.offlineXpAdjustments;

export default xpSlice.reducer;
