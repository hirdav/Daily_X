import { subscribeToUserStats, subscribeToTasks, Task } from '../utils/firebaseService';

// Define the stats interface
export interface DashboardStats {
  totalXP: number;
  todayXP: number;
  totalTasks: number;
  completedTasks: number;
  xpProgress: number;
  streakCount: number;
}

// Create a singleton stats service
class StatsService {
  private static instance: StatsService;
  private listeners: ((stats: DashboardStats) => void)[] = [];
  private stats: DashboardStats = {
    totalXP: 0,
    todayXP: 0,
    totalTasks: 0,
    completedTasks: 0,
    xpProgress: 0,
    streakCount: 0,
  };
  private unsubscribeTasks: (() => void) | null = null;
  private unsubscribeStats: (() => void) | null = null;
  private XP_CAP = 100; // Maximum XP per day
  private initialized = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  public static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  // Initialize subscriptions
  public initialize(userId: string): void {
    if (this.initialized) return;
    this.initialized = true;

    // Subscribe to tasks to get task counts
    this.unsubscribeTasks = subscribeToTasks((taskData: Task[]) => {
      let completedCount = 0;
      
      // Count completed tasks
      taskData.forEach(task => {
        if (task.completed) {
          completedCount++;
        }
      });
      
      // Update task-related stats
      this.stats = {
        ...this.stats,
        totalTasks: taskData.length,
        completedTasks: completedCount,
      };
      
      // Notify listeners
      this.notifyListeners();
    });
    
    // Subscribe to user stats
    this.unsubscribeStats = subscribeToUserStats((userStats) => {
      if (userStats) {
        this.stats = {
          ...this.stats,
          totalXP: userStats.totalXP || 0,
          todayXP: userStats.todayXP || 0,
          streakCount: userStats.streakCount || 0,
          xpProgress: Math.min(100, Math.round(((userStats.todayXP || 0) / this.XP_CAP) * 100))
        };
        
        // Notify listeners
        this.notifyListeners();
      }
    });
  }

  // Clean up subscriptions
  public cleanup(): void {
    if (this.unsubscribeTasks) {
      this.unsubscribeTasks();
      this.unsubscribeTasks = null;
    }
    
    if (this.unsubscribeStats) {
      this.unsubscribeStats();
      this.unsubscribeStats = null;
    }
    
    this.initialized = false;
  }

  // Get current stats
  public getStats(): DashboardStats {
    return { ...this.stats };
  }

  // Subscribe to stats updates
  public subscribe(listener: (stats: DashboardStats) => void): () => void {
    this.listeners.push(listener);
    
    // Immediately notify with current stats
    listener(this.getStats());
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners of stats updates
  private notifyListeners(): void {
    const currentStats = this.getStats();
    this.listeners.forEach(listener => {
      listener(currentStats);
    });
  }
}

// Export singleton instance
export const statsService = StatsService.getInstance();
