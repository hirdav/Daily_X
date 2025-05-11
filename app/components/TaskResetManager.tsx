import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { forceResetAllTasks } from '../utils/firebaseService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateString } from '../utils/dateUtils';

/**
 * TaskResetManager
 * 
 * This component handles automatic task reset on app startup.
 * It checks if tasks have been reset for the current day and
 * performs a reset if needed.
 * 
 * This is a "headless" component that doesn't render anything visible.
 */
const TaskResetManager = () => {
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    checkAndResetTasks();
  }, []);

  const checkAndResetTasks = async () => {
    try {
      // Prevent multiple resets
      if (isResetting) return;
      setIsResetting(true);

      // Get current date in the format YYYY-MM-DD
      const today = new Date();
      const todayStr = formatDateString(today);

      // Check when tasks were last reset
      const lastResetDate = await AsyncStorage.getItem('lastTaskResetDate');

      // If tasks haven't been reset today, reset them
      if (lastResetDate !== todayStr) {
        console.log('Performing automatic task reset for', todayStr);
        
        // Reset tasks
        const result = await forceResetAllTasks();
        console.log('Automatic task reset result:', result.message);
        
        // Update last reset date
        await AsyncStorage.setItem('lastTaskResetDate', todayStr);
      } else {
        console.log('Tasks already reset for today:', todayStr);
      }
    } catch (error) {
      console.error('Error in automatic task reset:', error);
    } finally {
      setIsResetting(false);
    }
  };

  // This component doesn't render anything visible
  return null;
};

export default TaskResetManager;
