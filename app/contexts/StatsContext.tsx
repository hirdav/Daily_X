import React, { createContext, useContext, useState, useEffect } from 'react';
import { subscribeToUserStats, subscribeToTasks, Task } from '../utils/firebaseService';
import { FIREBASE_AUTH } from '../../FirebaseConfig';

// Define the stats interface
export interface DashboardStats {
  totalXP: number;
  todayXP: number;
  totalTasks: number;
  completedTasks: number;
  xpProgress: number;
  streakCount: number;
}

// Create the context with default values
const StatsContext = createContext<{
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
}>({
  stats: {
    totalXP: 0,
    todayXP: 0,
    totalTasks: 0,
    completedTasks: 0,
    xpProgress: 0,
    streakCount: 0,
  },
  loading: true,
  error: null,
});

// Create a provider component
export const StatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalXP: 0,
    todayXP: 0,
    totalTasks: 0,
    completedTasks: 0,
    xpProgress: 0,
    streakCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const XP_CAP = 100; // Maximum XP per day

  useEffect(() => {
    const user = FIREBASE_AUTH.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Subscribe to tasks to get task counts
    const unsubscribeTasks = subscribeToTasks((taskData: Task[]) => {
      let completedCount = 0;
      
      // Count completed tasks
      taskData.forEach(task => {
        if (task.completed) {
          completedCount++;
        }
      });
      
      // Update task-related stats
      setStats(prevStats => ({
        ...prevStats,
        totalTasks: taskData.length,
        completedTasks: completedCount,
      }));
    });
    
    // Subscribe to user stats
    const unsubscribeStats = subscribeToUserStats(
      (userStats) => {
        if (userStats) {
          setStats(prevStats => ({
            ...prevStats,
            totalXP: userStats.totalXP || 0,
            todayXP: userStats.todayXP || 0,
            streakCount: userStats.streakCount || 0,
            xpProgress: Math.min(100, Math.round(((userStats.todayXP || 0) / XP_CAP) * 100))
          }));
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error in user stats subscription:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeTasks();
      unsubscribeStats();
    };
  }, []);

  return (
    <StatsContext.Provider value={{ stats, loading, error }}>
      {children}
    </StatsContext.Provider>
  );
};

// Create a custom hook to use the stats context
export const useStats = () => useContext(StatsContext);
