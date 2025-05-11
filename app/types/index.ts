import { Timestamp } from 'firebase/firestore';

export interface Task {
  id: string;
  title: string;
  description?: string; // Making this optional to match firebaseService
  category?: string;
  emoji?: string;
  xp: number;
  plannedXp?: number;
  originalXp?: number;
  wasAdjusted?: boolean;
  userId: string;
  completed: boolean;
  createdAt: Timestamp;
  completedAt?: Timestamp | null;
  isPending?: boolean;
  syncStatus?: 'synced' | 'pending' | 'error';
  lastSyncAttempt?: number;
  recurring?: boolean;
  lastCompletedDate?: string | null;
  adjustmentReason?: string;
}

export interface JournalEntry {
  thought: string;
  entry?: string;
  mood?: string;
  timestamp: Timestamp;
  userId: string;
}

export interface DailyStats {
  date: string;
  tasksCompleted: number;
  xpEarned: number;
  totalDailyXP: number; // Total XP collected for the day (for weekly chart)
  hasJournal?: boolean;
  tasks?: Task[];
  journalEntry?: JournalEntry;
  userId?: string; // User ID for the stats
  lastUpdated?: Timestamp; // When the stats were last updated
}

export interface MarkedDates {
  [date: string]: {
    marked: boolean;
    dotColor: string;
  };
}

export interface OverallStats {
  totalTasks: number;
  completedTasks: number;
  totalXP: number;
  avgCompletionTime: number;
  bestDay: string;
  bestDayXP: number;
  streakCount: number;
  xpEfficiency: number; // Percentage of available XP used effectively
  todayXP: number; // XP earned today
  todayTasksCompleted: number; // Tasks completed today
  todayTasksTotal: number; // Total tasks for today
  weeklyXP: number; // XP earned this week
  weeklyXPGoal: number; // Weekly XP goal
  dailyHistory: Map<string, DailyStats>; // Store daily stats by date for historical reference
}

export interface UserStats {
  userId: string;
  totalXP: number;
  todayXP: number;
  streakCount: number;
  lastActive: Timestamp;
  bestDay: string;
  bestDayXP: number;
  weeklyXPGoal: number;
  lastReset: Timestamp;
}

export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  category?: string;
  xp: number;
  completedAt: Timestamp | null;
  date: string;
  userId: string;
  action: 'completed' | 'uncompleted' | 'created' | 'updated' | 'deleted';
  recurring?: boolean;
  previousState?: any;
  updates?: any;
  deviceId?: string;
  timestamp: Timestamp;
}

export interface DateRange {
  start: string | null;
  end: string | null;
}
