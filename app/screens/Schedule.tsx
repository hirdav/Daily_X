import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RootStackParamList } from '../navigation/types';
import { Colors, Typography, Spacing, GlobalStyles } from '../styles/global';
import { ScheduledTask } from '../types/scheduledTask';
import { 
  subscribeToScheduledTasks, 
  addScheduledTask, 
  updateScheduledTask, 
  deleteScheduledTask, 
  updateScheduledTaskStatus,
  checkForMissedTasks
} from '../utils/scheduledTaskService';
// Using built-in React Native components for date/time selection
import { useTheme } from '../contexts/ThemeContext';
import { formatDateString } from '../utils/dateUtils';

type ScheduleScreenProps = {
  navigation: DrawerNavigationProp<RootStackParamList, 'Schedule'>;
};

const ScheduleScreen: React.FC<ScheduleScreenProps> = ({ navigation }) => {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<('upcoming' | 'completed' | 'missed')[]>(['upcoming']);
  
  // Calendar view state
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [calendarHeight] = useState(new Animated.Value(0));
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [timeSelectionMode, setTimeSelectionMode] = useState<'hour' | 'minute'>('hour');
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [repeatFrequency, setRepeatFrequency] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'scheduled' | 'due'>('scheduled');

  // Load tasks
  useEffect(() => {
    const checkMissed = async () => {
      const missedCount = await checkForMissedTasks();
      if (missedCount > 0) {
        console.log(`Updated ${missedCount} tasks to missed status`);
      }
    };
    
    checkMissed();
    
    const unsubscribe = subscribeToScheduledTasks(
      (loadedTasks) => {
        // If a date is selected in the calendar, filter tasks for that date
        if (selectedDate) {
          const filteredTasks = loadedTasks.filter(task => task.scheduledDate === selectedDate);
          setTasks(filteredTasks);
        } else {
          setTasks(loadedTasks);
        }
        setLoading(false);
      },
      { status: statusFilter }
    );
    
    return () => unsubscribe();
  }, [statusFilter, selectedDate]);

  // Reset form when modal is closed
  useEffect(() => {
    if (!modalVisible) {
      resetForm();
    }
  }, [modalVisible]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setScheduledDate(new Date());
    setScheduledTime(null);
    setDueDate(null);
    setRepeatFrequency('none');
    setNotificationEnabled(true);
    setEditingTask(null);
  };

  const handleOpenModal = (task?: ScheduledTask) => {
    if (task) {
      // Edit mode
      setEditingTask(task);
      setTitle(task.title);
      setDescription(task.description || '');
      setScheduledDate(new Date(task.scheduledDate));
      
      if (task.scheduledTime) {
        const [hours, minutes] = task.scheduledTime.split(':').map(Number);
        const timeDate = new Date();
        timeDate.setHours(hours, minutes, 0, 0);
        setScheduledTime(timeDate);
        setSelectedHour(hours);
        setSelectedMinute(minutes);
      } else {
        setScheduledTime(null);
      }
      
      // Properly handle due date if it exists
      if (task.dueDate) {
        const dueDateObj = new Date(task.dueDate);
        setDueDate(dueDateObj);
        console.log(`Setting due date to ${dueDateObj.toISOString()} from ${task.dueDate}`);
      } else {
        setDueDate(null);
        console.log(`No due date found for task ${task.title}`);
      }
      
      setRepeatFrequency(task.repeatFrequency);
      setNotificationEnabled(task.notificationEnabled);
    } else {
      // Create mode - reset form
      resetForm();
    }
    
    setModalVisible(true);
  };

  // Use a ref to track if a save operation is in progress
  const isSaving = useRef(false);

  const handleSaveTask = async () => {
    // Prevent duplicate submissions
    if (isSaving.current) return;
    
    try {
      isSaving.current = true;
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    // Create date at noon to avoid timezone issues
    const scheduledDateTime = new Date(Date.UTC(
      scheduledDate.getFullYear(),
      scheduledDate.getMonth(),
      scheduledDate.getDate(),
      scheduledTime ? scheduledTime.getHours() : 12,
      scheduledTime ? scheduledTime.getMinutes() : 0,
      0
    ));
    
    // Check if the scheduled date is before today
    const now = new Date();
    const todayStart = new Date(Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0
    ));
    
    const scheduledDateOnly = new Date(Date.UTC(
      scheduledDate.getFullYear(),
      scheduledDate.getMonth(),
      scheduledDate.getDate(),
      0, 0, 0
    ));
    
    if (scheduledDateOnly < todayStart) {
      Alert.alert('Error', 'Cannot schedule events for past dates. Please select today or a future date.');
      return;
    }
    
    // If scheduled for today, check if time is in the past (only if time is specified)
    const isToday = scheduledDateOnly.getTime() === todayStart.getTime();
    if (isToday && scheduledTime) {
      const nowTime = new Date();
      const scheduledTimeObj = new Date();
      scheduledTimeObj.setHours(scheduledTime.getHours(), scheduledTime.getMinutes(), 0, 0);
      
      if (scheduledTimeObj < nowTime) {
        Alert.alert('Error', 'Cannot schedule events for past times. Please select a future time for today.');
        return;
      }
    }
    
    // Validate due date is after scheduled date if provided
    if (dueDate) {
      const dueDateObj = new Date(Date.UTC(
        dueDate.getFullYear(),
        dueDate.getMonth(),
        dueDate.getDate(),
        12, 0, 0
      ));
      
      if (dueDateObj < scheduledDateTime) {
        Alert.alert('Error', 'Due date must be after the scheduled date.');
        return;
      }
    }
    
    // Format the scheduled date as YYYY-MM-DD
    const formattedDate = `${scheduledDateTime.getUTCFullYear()}-${String(scheduledDateTime.getUTCMonth() + 1).padStart(2, '0')}-${String(scheduledDateTime.getUTCDate()).padStart(2, '0')}`;
    
    // Format the due date as YYYY-MM-DD if provided
    const formattedDueDate = dueDate 
      ? `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}` 
      : undefined;
      
    console.log(`Saving task with due date: ${formattedDueDate || 'none'}`);
    
    // Format the time as HH:MM if provided
    const formattedTime = scheduledTime 
      ? `${String(scheduledTime.getHours()).padStart(2, '0')}:${String(scheduledTime.getMinutes()).padStart(2, '0')}` 
      : undefined;
    
    const taskData = {
      title,
      description: description.trim() || undefined,
      scheduledDate: formattedDate,
      scheduledTime: formattedTime,
      dueDate: formattedDueDate,
      repeatFrequency,
      notificationEnabled,
    };
    
    let result;
    
    if (editingTask) {
      // Update existing task
      result = await updateScheduledTask(editingTask.id, taskData);
    } else {
      // Create new task
      result = await addScheduledTask(taskData);
    }

    if (result.success) {
      setModalVisible(false);
      resetForm();
    } else {
      Alert.alert('Error', result.message || 'Failed to save event');
    }
    } finally {
      // Reset the saving state after a short delay to prevent rapid re-clicks
      setTimeout(() => {
        isSaving.current = false;
      }, 500);
    }
  };

  // Use a ref to track if a delete operation is in progress
  const isDeleting = useRef(false);

  const handleDeleteTask = async (taskId: string) => {
    // Prevent duplicate delete operations
    if (isDeleting.current) return;
    isDeleting.current = true;
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteScheduledTask(taskId);
              if (!result.success) {
                Alert.alert('Error', result.message || 'Failed to delete event');
              }
            } finally {
              // Reset the deleting state after a short delay
              setTimeout(() => {
                isDeleting.current = false;
              }, 500);
            }
          }
        }
      ]
    );
  };

  const handleStatusChange = async (taskId: string, status: 'upcoming' | 'completed' | 'missed') => {
    const result = await updateScheduledTaskStatus(taskId, status);
    if (!result.success) {
      Alert.alert('Error', result.message || `Failed to mark event as ${status}`);
    }
  };

  // Custom date selection handler
  const handleDateSelection = (year: number, month: number, day: number) => {
    // Create date at noon UTC to avoid timezone issues
    const newDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
    
    if (datePickerMode === 'scheduled') {
      setScheduledDate(newDate);
      
      // If due date exists and is now before scheduled date, update it
      if (dueDate && newDate > dueDate) {
        // Set due date to scheduled date + 1 day
        const newDueDate = new Date(newDate);
        newDueDate.setDate(newDueDate.getDate() + 1);
        setDueDate(newDueDate);
      }
    } else {
      // Ensure due date is not before scheduled date
      if (newDate >= scheduledDate) {
        setDueDate(newDate);
      } else {
        Alert.alert('Error', 'Due date cannot be before the scheduled date.');
      }
    }
    
    setShowDatePicker(false);
  };

  // Custom time selection handler
  const handleTimeSelection = (hours: number, minutes: number) => {
    const newTime = new Date();
    newTime.setHours(hours, minutes, 0, 0);
    setScheduledTime(newTime);
    setShowTimePicker(false);
  };

  const renderTaskItem = ({ item }: { item: ScheduledTask }) => {
    const isCompleted = item.status === 'completed';
    const isMissed = item.status === 'missed';
    
    // Check if event is due today or overdue
    const isDue = item.dueDate ? new Date(item.dueDate) <= new Date() : false;
    console.log(`Event ${item.title} has dueDate: ${item.dueDate}`);
    
    return (
      <View style={[
        styles.taskItem, 
        { backgroundColor: colors.cardBackground },
        isCompleted && styles.completedTask,
        isMissed && styles.missedTask,
        isDue && !isCompleted && styles.dueTask
      ]}>
        <View style={styles.taskHeader}>
          <Text style={[styles.taskTitle, { color: colors.text }]}>{item.title}</Text>
          <View style={styles.taskActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleOpenModal(item)}
            >
              <MaterialIcons name="edit" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeleteTask(item.id)}
            >
              <MaterialIcons name="delete" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.taskDetails}>
          {/* Date and time row */}
          <View style={styles.taskDetailRow}>
            <View style={styles.taskDetail}>
              <MaterialIcons name="event" size={16} color={colors.textSecondary} />
              <Text style={[styles.taskDetailText, { color: colors.textSecondary }]}>
                Start: {new Date(item.scheduledDate).toLocaleDateString()}
              </Text>
            </View>
            
            {item.scheduledTime && (
              <View style={styles.taskDetail}>
                <MaterialIcons name="access-time" size={16} color={colors.textSecondary} />
                <Text style={[styles.taskDetailText, { color: colors.textSecondary }]}>
                  {item.scheduledTime}
                </Text>
              </View>
            )}
          </View>
          
          {/* Due date and repeat row */}
          <View style={styles.taskDetailRow}>
            {item.dueDate && (
              <View style={styles.taskDetail}>
                <MaterialIcons 
                  name="event-available" 
                  size={16} 
                  color={isDue ? colors.warning : colors.textSecondary} 
                />
                <Text style={[
                  styles.taskDetailText, 
                  { 
                    color: isDue ? colors.warning : colors.textSecondary,
                    fontWeight: isDue ? '600' : '400'
                  }
                ]}>
                  Due: {new Date(item.dueDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            
            {item.repeatFrequency !== 'none' && (
              <View style={styles.taskDetail}>
                <MaterialIcons name="repeat" size={16} color={colors.primary} />
                <Text style={[styles.taskDetailText, { color: colors.primary }]}>
                  {item.repeatFrequency === 'weekly' ? 'Weekly' : 'Monthly'}
                  {/* {item.dueDate ? ` until ${new Date(item.dueDate).toLocaleDateString()}` : ''} */}
                </Text>
              </View>
            )}
          </View>
          
          {/* Reminder row */}
          {item.notificationEnabled && (
            <View style={styles.taskDetailRow}>
              <View style={styles.taskDetail}>
                <MaterialIcons name="notifications" size={16} color={colors.textSecondary} />
                <Text style={[styles.taskDetailText, { color: colors.textSecondary }]}>
                  Reminder on
                </Text>
              </View>
            </View>
          )}
        </View>
        
        {item.description && (
          <Text style={[styles.taskDescription, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.statusActions}>
          {item.status === 'upcoming' && (
            <TouchableOpacity 
              style={[styles.statusButton, styles.completeButton]}
              onPress={() => handleStatusChange(item.id, 'completed')}
            >
              <MaterialIcons name="check" size={18} color="#fff" />
              <Text style={styles.statusButtonText}>Complete</Text>
            </TouchableOpacity>
          )}
          
          {item.status === 'completed' && (
            <TouchableOpacity 
              style={[styles.statusButton, styles.resetButton]}
              onPress={() => handleStatusChange(item.id, 'upcoming')}
            >
              <MaterialIcons name="refresh" size={18} color="#fff" />
              <Text style={styles.statusButtonText}>Reset</Text>
            </TouchableOpacity>
          )}
          
          {item.status === 'missed' && (
            <TouchableOpacity 
              style={[styles.statusButton, styles.rescheduleButton]}
              onPress={() => handleStatusChange(item.id, 'upcoming')}
            >
              <MaterialIcons name="update" size={18} color="#fff" />
              <Text style={styles.statusButtonText}>Reschedule</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Generate recurring dates for an event based on its frequency
  const generateRecurringDates = useCallback((task: ScheduledTask, monthsAhead: number = 3) => {
    if (task.repeatFrequency === 'none') {
      return [task.scheduledDate];
    }

    const dates: string[] = [task.scheduledDate];
    const startDate = new Date(task.scheduledDate);
    
    // If a due date is set, use it as the end date for recurring events
    // Otherwise, look ahead a few months as a reasonable default
    let endDate;
    if (task.dueDate) {
      endDate = new Date(task.dueDate);
      console.log(`Using due date ${task.dueDate} as end date for recurring event`);
    } else {
      endDate = new Date();
      endDate.setMonth(endDate.getMonth() + monthsAhead); // Look ahead a few months
    }
    
    let currentDate = new Date(startDate);
    
    // Add one occurrence to avoid infinite loop
    if (task.repeatFrequency === 'weekly') {
      currentDate.setDate(currentDate.getDate() + 7);
      
      while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        dates.push(dateString);
        currentDate.setDate(currentDate.getDate() + 7);
        
        // Safety check to prevent excessive iterations
        if (dates.length > 52) { // Maximum of one year of weekly occurrences
          console.warn('Reached maximum number of weekly recurrences');
          break;
        }
      }
    } else if (task.repeatFrequency === 'monthly') {
      const dayOfMonth = startDate.getDate();
      
      currentDate.setMonth(currentDate.getMonth() + 1);
      
      while (currentDate <= endDate) {
        // Handle edge cases like Feb 29, 30, 31
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const validDay = Math.min(dayOfMonth, lastDayOfMonth);
        
        currentDate.setDate(validDay);
        const dateString = currentDate.toISOString().split('T')[0];
        dates.push(dateString);
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        
        // Safety check to prevent excessive iterations
        if (dates.length > 24) { // Maximum of 2 years of monthly occurrences
          console.warn('Reached maximum number of monthly recurrences');
          break;
        }
      }
    }
    
    return dates;
  }, []);

  // Group events by date for the calendar view, including recurring instances
  const getTasksByDate = useCallback(() => {
    const taskMap: Record<string, ScheduledTask[]> = {};
    
    tasks.forEach(task => {
      // For non-recurring events or the original date of recurring events
      const dateKey = task.scheduledDate;
      if (!taskMap[dateKey]) {
        taskMap[dateKey] = [];
      }
      taskMap[dateKey].push(task);
      
      // For recurring events, add virtual instances to future dates
      if (task.repeatFrequency !== 'none') {
        const recurringDates = generateRecurringDates(task);
        
        // Skip the first date as it's already added above
        recurringDates.slice(1).forEach(date => {
          if (!taskMap[date]) {
            taskMap[date] = [];
          }
          
          // Create a virtual copy of the event for this date
          const virtualTask: ScheduledTask = {
            ...task,
            scheduledDate: date,
            // Mark it as a recurring instance (not stored in DB)
            id: `${task.id}-recurring-${date}`
          };
          
          taskMap[date].push(virtualTask);
        });
      }
    });
    
    return taskMap;
  }, [tasks, generateRecurringDates]);

  // Get event count for a specific date
  const getTaskCountForDate = useCallback((dateString: string) => {
    const tasksByDate = getTasksByDate();
    const directTasks = tasksByDate[dateString]?.length || 0;
    
    // Also count events that are due on this date
    const dueTasks = tasks.filter(task => task.dueDate === dateString).length;
    
    return directTasks + dueTasks;
  }, [getTasksByDate, tasks]);
  
  // Get event status counts for a specific date
  const getTaskStatusCountsForDate = useCallback((dateString: string) => {
    const tasksByDate = getTasksByDate();
    const tasks = tasksByDate[dateString] || [];
    
    return {
      upcoming: tasks.filter(t => t.status === 'upcoming').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      missed: tasks.filter(t => t.status === 'missed').length,
      dueToday: tasks.filter(t => t.dueDate === dateString).length
    };
  }, [getTasksByDate]);

  // Toggle calendar expansion
  const toggleCalendar = useCallback(() => {
    const finalValue = calendarExpanded ? 0 : 300; // Height when expanded
    setCalendarExpanded(!calendarExpanded);
    
    Animated.timing(calendarHeight, {
      toValue: finalValue,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [calendarExpanded, calendarHeight]);
  
  const renderFilterButton = (status: 'upcoming' | 'completed' | 'missed', label: string, icon: string) => {
    const isActive = statusFilter.includes(status);
    
    return (
      <TouchableOpacity 
        style={[
          styles.filterButton, 
          isActive && styles.activeFilterButton
        ]}
        onPress={() => {
          if (isActive && statusFilter.length === 1) {
            // Don't allow deselecting the last filter
            return;
          }
          
          if (isActive) {
            setStatusFilter(statusFilter.filter(s => s !== status));
          } else {
            setStatusFilter([...statusFilter, status]);
          }
        }}
      >
        <MaterialIcons 
          name={icon as any} 
          size={16} 
          color={isActive ? '#FFFFFF' : '#333333'} 
        />
        <Text 
          style={[
            styles.filterButtonText, 
            isActive && styles.activeFilterButtonText
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <MaterialIcons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Schedule</Text>
        <TouchableOpacity onPress={() => handleOpenModal()}>
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.filtersContainer}>
        {renderFilterButton('upcoming', 'Upcoming', 'event')}
        {renderFilterButton('completed', 'Completed', 'check-circle')}
        {renderFilterButton('missed', 'Missed', 'event-busy')}
      </View>
      
      <View style={styles.calendarContainer}>
        <View style={styles.calendarToggleRow}>
          <TouchableOpacity 
            style={styles.calendarToggleButton}
            onPress={toggleCalendar}
          >
            <MaterialIcons 
              name={calendarExpanded ? 'expand-less' : 'expand-more'} 
              size={22} 
              color={colors.primary} 
            />
            <Text style={styles.calendarToggleText}>
              {calendarExpanded ? 'Hide Calendar' : 'Show Calendar'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.calendarReloadButton}
            onPress={() => {
              // Reload tasks and reset any date selection
              setLoading(true);
              setSelectedDate(null);
              checkForMissedTasks().then(() => setLoading(false));
            }}
          >
            <MaterialIcons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.calendarToggleText}>Reload</Text>
          </TouchableOpacity>
        </View>
        
        <Animated.View style={[styles.calendarWrapper, { height: calendarHeight, overflow: 'hidden' }]}>
          <View style={styles.calendarMonthSelector}>
            <TouchableOpacity
              onPress={() => {
                // Create a new UTC date to avoid timezone issues
                const newDate = new Date(Date.UTC(
                  calendarViewDate.getFullYear(),
                  calendarViewDate.getMonth() - 1,
                  1, 12, 0, 0
                ));
                setCalendarViewDate(newDate);
              }}
            >
              <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
            </TouchableOpacity>
            
            <Text style={[styles.calendarMonthTitle, { color: colors.text }]}>
              {new Date(Date.UTC(
                calendarViewDate.getFullYear(),
                calendarViewDate.getMonth(),
                1, 12, 0, 0
              )).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
            
            <TouchableOpacity
              onPress={() => {
                // Create a new UTC date to avoid timezone issues
                const newDate = new Date(Date.UTC(
                  calendarViewDate.getFullYear(),
                  calendarViewDate.getMonth() + 1,
                  1, 12, 0, 0
                ));
                setCalendarViewDate(newDate);
              }}
            >
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {/* Weekday Headers */}
          <View style={styles.calendarWeekdayHeader}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Text 
                key={day} 
                style={[styles.calendarWeekdayText, { color: colors.textSecondary }]}
              >
                {day}
              </Text>
            ))}
          </View>
          
          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {(() => {
              // Generate calendar days
              const days = [];
              const currentMonth = calendarViewDate.getMonth();
              const currentYear = calendarViewDate.getFullYear();
              
              // Create a date for the first day of the month
              const firstDay = new Date(currentYear, currentMonth, 1);
              const startingDayOfWeek = firstDay.getDay();
              
              // Add empty cells for days before the first day of the month
              for (let i = 0; i < startingDayOfWeek; i++) {
                days.push(
                  <View key={`empty-${i}`} style={styles.calendarDay} />
                );
              }
              
              // Get the number of days in the current month
              const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
              
              // Current date for highlighting today - using UTC to avoid timezone issues
              const now = new Date();
              const today = new Date(Date.UTC(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                12, 0, 0
              ));
              const isToday = (day: number) => {
                return (
                  today.getUTCDate() === day &&
                  today.getUTCMonth() === currentMonth &&
                  today.getUTCFullYear() === currentYear
                );
              };
              
              // Check if a day is selected
              const isSelected = (day: number) => {
                return (
                  selectedDate === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                );
              };
              
              // Add days of the month
              for (let i = 1; i <= daysInMonth; i++) {
                // Create date at noon UTC to avoid timezone issues
                const dateObj = new Date(Date.UTC(currentYear, currentMonth, i, 12, 0, 0));
                // Format as YYYY-MM-DD without timezone conversion
                // IMPORTANT: getUTCMonth() is 0-indexed, so we need to add 1 to get the correct month number
                // But we need to ensure we're using the correct month value (not 0-indexed) for proper comparison
                const dateString = `${dateObj.getUTCFullYear()}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const taskCount = getTaskCountForDate(dateString);
                const statusCounts = getTaskStatusCountsForDate(dateString);
                const hasTasks = taskCount > 0;
                
                days.push(
                  <TouchableOpacity
                    key={`day-${i}`}
                    style={[
                      styles.calendarDay,
                      isToday(i) && styles.calendarTodayDay,
                      isSelected(i) && styles.calendarSelectedDay,
                      hasTasks && styles.calendarDayWithTasks
                    ]}
                    onPress={() => {
                      // Toggle selection or select new date
                      if (selectedDate === dateString) {
                        setSelectedDate(null);
                      } else {
                        setSelectedDate(dateString);
                      }
                      
                      // Show quick action menu on long press
                      if (Platform.OS === 'web') {
                        // For web, we'll use a tooltip or modal in a future implementation
                      }
                    }}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      { color: colors.text },
                      isToday(i) && { color: colors.primary, fontWeight: 'bold' },
                      isSelected(i) && { color: '#fff' }
                    ]}>
                      {i}
                    </Text>
                    
                    {hasTasks && (
                      <View style={styles.calendarDayIndicators}>
                        {statusCounts.upcoming > 0 && (
                          <View style={[styles.calendarDayDot, { backgroundColor: colors.primary }]} />
                        )}
                        {statusCounts.completed > 0 && (
                          <View style={[styles.calendarDayDot, { backgroundColor: colors.success }]} />
                        )}
                        {statusCounts.missed > 0 && (
                          <View style={[styles.calendarDayDot, { backgroundColor: colors.error }]} />
                        )}
                        {statusCounts.dueToday > 0 && (
                          <View style={[styles.calendarDayDot, { backgroundColor: colors.warning }]} />
                        )}
                        {/* Show a special indicator for recurring events with better visibility */}
                        {tasks.some(t => t.scheduledDate === dateString && t.repeatFrequency !== 'none') && (
                          <View style={styles.recurringIndicator}>
                            <MaterialIcons name="repeat" size={10} color={colors.primary} />
                          </View>
                        )}
                        
                        {/* Add event count when multiple events exist */}
                        {taskCount > 1 && (
                          <View style={styles.eventCountBadge}>
                            <Text style={styles.eventCountText}>{taskCount}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }
              
              return days;
            })()}
          </View>
          
          {/* Legend */}
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>Upcoming</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>Completed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>Missed</Text>
            </View>
            <View style={styles.legendItem}>
              <MaterialIcons name="repeat" size={12} color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>Recurring</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>Due Today</Text>
            </View>
          </View>
        </Animated.View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="event-note" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {selectedDate ? 
              `No Events on ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}` : 
              `No ${statusFilter.join('/')} Events found`}
          </Text>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              // If a date is selected, pre-populate that date when opening the modal
              if (selectedDate) {
                const dateObj = new Date(selectedDate);
                setScheduledDate(dateObj);
                handleOpenModal();
              } else {
                handleOpenModal();
              }
            }}
          >
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Schedule an Event{selectedDate ? ` for ${new Date(selectedDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}` : ''}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
        <FlatList
          data={tasks}
          renderItem={renderTaskItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.taskList}
        />
        
        {/* Floating Action Button for quick task creation */}
        <TouchableOpacity 
          style={[styles.floatingActionButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            // If a date is selected, pre-populate that date when opening the modal
            if (selectedDate) {
              const dateObj = new Date(selectedDate);
              setScheduledDate(dateObj);
              handleOpenModal();
            } else {
              handleOpenModal();
            }
          }}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>  
      )}
      
      {/* Task Form Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingTask ? 'Update' : 'Schedule an Event'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Title</Text>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    backgroundColor: colors.cardBackground,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter Event name"
                placeholderTextColor={colors.textSecondary}
                maxLength={200}
              />
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Start Date</Text>
              <TouchableOpacity
                style={[
                  styles.input, 
                  styles.dateInput, 
                  { 
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingVertical: 14
                  }
                ]}
                onPress={() => {
                  setDatePickerMode('scheduled');
                  setShowDatePicker(true);
                }}
              >
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>
                  {scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <MaterialIcons name="event" size={24} color={colors.primary} />
              </TouchableOpacity>
              
              {/* Calendar Date Picker Modal */}
              <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.pickerModalContainer}>
                  <View style={[styles.pickerModalContent, { backgroundColor: colors.cardBackground }]}>
                    <View style={[styles.pickerModalHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.pickerModalTitle, { color: colors.text }]}>
                        {datePickerMode === 'scheduled' ? 'Select Start Date' : 'Select Due Date'}
                      </Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.calendarContainer}>
                      {/* Custom calendar implementation */}
                      <View style={styles.calendarHeader}>
                        <TouchableOpacity
                          style={styles.calendarNavButton}
                          onPress={() => {
                            const newDate = new Date(scheduledDate);
                            newDate.setMonth(newDate.getMonth() - 1);
                            setScheduledDate(newDate);
                          }}
                        >
                          <MaterialIcons name="chevron-left" size={24} color={colors.primary} />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => {
                            // Reset to current month when title is clicked
                            setScheduledDate(new Date());
                          }}
                        >
                          <Text style={[styles.calendarMonthTitle, { color: colors.text }]}>
                            {scheduledDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.calendarNavButton}
                          onPress={() => {
                            const newDate = new Date(scheduledDate);
                            newDate.setMonth(newDate.getMonth() + 1);
                            setScheduledDate(newDate);
                          }}
                        >
                          <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                      
                      {/* Weekday Headers */}
                      <View style={styles.calendarWeekdayHeader}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                          <Text 
                            key={day} 
                            style={[styles.calendarWeekdayText, { color: colors.textSecondary }]}
                          >
                            {day}
                          </Text>
                        ))}
                      </View>
                      
                      {/* Calendar Grid */}
                      <View style={styles.calendarGrid}>
                        {(() => {
                          // Generate calendar days
                          const days = [];
                          const currentMonth = scheduledDate.getMonth();
                          const currentYear = scheduledDate.getFullYear();
                          
                          // Create a date for the first day of the month
                          const firstDay = new Date(currentYear, currentMonth, 1);
                          const startingDayOfWeek = firstDay.getDay();
                          
                          // Add empty cells for days before the first day of the month
                          for (let i = 0; i < startingDayOfWeek; i++) {
                            days.push(
                              <View key={`empty-${i}`} style={styles.calendarDay} />
                            );
                          }
                          
                          // Get the number of days in the current month
                          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                          
                          // Current date for highlighting today
                          const today = new Date();
                          const isToday = (day: number) => {
                            return (
                              today.getDate() === day &&
                              today.getMonth() === currentMonth &&
                              today.getFullYear() === currentYear
                            );
                          };
                          
                          // Check if a day is selected
                          const isSelected = (day: number) => {
                            return (
                              scheduledDate.getDate() === day &&
                              scheduledDate.getMonth() === currentMonth &&
                              scheduledDate.getFullYear() === currentYear
                            );
                          };
                          
                          // Add days of the month
                          for (let i = 1; i <= daysInMonth; i++) {
                            const dayDate = new Date(currentYear, currentMonth, i);
                            const isPastDay = dayDate < new Date(today.setHours(0, 0, 0, 0));
                            
                            days.push(
                              <TouchableOpacity
                                key={`day-${i}`}
                                style={[
                                  styles.calendarDay,
                                  isSelected(i) && [styles.calendarSelectedDay, { backgroundColor: colors.primary }],
                                  isToday(i) && !isSelected(i) && styles.calendarTodayDay
                                ]}
                                onPress={() => {
                                  if (!isPastDay) {
                                    handleDateSelection(currentYear, currentMonth, i);
                                  }
                                }}
                                disabled={isPastDay}
                              >
                                <Text style={[
                                  styles.calendarDayText,
                                  { color: isPastDay ? colors.textSecondary + '50' : colors.text },
                                  isSelected(i) && { color: '#fff' },
                                  isToday(i) && !isSelected(i) && { color: colors.primary }
                                ]}>
                                  {i}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                          
                          return days;
                        })()}
                      </View>
                    </View>
                    
                    <View style={styles.datePickerActions}>
                      <TouchableOpacity 
                        style={styles.datePickerCancelButton}
                        onPress={() => {
                          // Debounce the cancel button
                          if (showDatePicker) setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.datePickerCancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.datePickerConfirmButton}
                        onPress={() => {
                          // Debounce the confirm button
                          if (showDatePicker) setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.datePickerConfirmButtonText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
              
              {/* Time field removed to simplify interface */}
              
              {/* Clock Time Picker Modal */}
              <Modal
                visible={showTimePicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTimePicker(false)}
              >
                <View style={styles.pickerModalContainer}>
                  <View style={[styles.pickerModalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.timePickerHeader}>
                      <Text style={[styles.timePickerTitle, { color: colors.text }]}>
                        Select Time
                      </Text>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Time Display */}
                    <View style={styles.timeDisplayContainer}>
                      <TouchableOpacity 
                        onPress={() => setTimeSelectionMode('hour')}
                        style={styles.timeDisplayButtonContainer}
                      >
                        <Text style={[
                          styles.timeDisplayText, 
                          timeSelectionMode === 'hour' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }
                        ]}>
                          {String(selectedHour === 0 ? 12 : selectedHour > 12 ? selectedHour - 12 : selectedHour).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                      
                      <Text style={styles.timeDisplaySeparator}>:</Text>
                      
                      <TouchableOpacity 
                        onPress={() => setTimeSelectionMode('minute')}
                        style={styles.timeDisplayButtonContainer}
                      >
                        <Text style={[
                          styles.timeDisplayText, 
                          timeSelectionMode === 'minute' ? { color: colors.primary, fontWeight: '700' } : { color: colors.text }
                        ]}>
                          {String(selectedMinute).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* AM/PM Selection */}
                    <View style={styles.amPmContainer}>
                      <TouchableOpacity 
                        style={[styles.amPmButton, selectedHour < 12 && styles.amPmButtonActive]}
                        onPress={() => {
                          if (selectedHour >= 12) {
                            setSelectedHour(selectedHour - 12);
                          }
                        }}
                      >
                        <Text style={[styles.amPmButtonText, selectedHour < 12 && styles.amPmButtonTextActive]}>AM</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.amPmButton, selectedHour >= 12 && styles.amPmButtonActive]}
                        onPress={() => {
                          if (selectedHour < 12) {
                            setSelectedHour(selectedHour + 12);
                          }
                        }}
                      >
                        <Text style={[styles.amPmButtonText, selectedHour >= 12 && styles.amPmButtonTextActive]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Clock View */}
                    <View style={styles.clockContainer}>
                      <View style={[styles.clockFace, { backgroundColor: colors.background }]}>
                        {/* Clock Center */}
                        <View style={[styles.clockCenter, { backgroundColor: colors.primary }]} />
                        
                        {/* Clock Hand */}
                        <View 
                          style={[
                            styles.clockHand, 
                            { 
                              backgroundColor: colors.primary,
                              width: 100,
                              transform: [{ 
                                rotate: `${timeSelectionMode === 'hour' 
                                  ? ((selectedHour % 12) * 30) // 0 represents 12 in the 12-hour format
                                  : (selectedMinute * 6)}deg` 
                              }] 
                            }
                          ]} 
                        />
                        
                        {/* Clock Numbers */}
                        {timeSelectionMode === 'hour' ? (
                          // Hours
                          [...Array(12)].map((_, i) => {
                            const hour = i + 1;
                            const angle = hour * 30;
                            const isSelected = (selectedHour % 12 || 12) === hour;
                            
                            // Calculate position
                            const radius = 100;
                            const radian = (angle - 90) * (Math.PI / 180);
                            const left = 125 + radius * Math.cos(radian) - 20;
                            const top = 125 + radius * Math.sin(radian) - 20;
                            
                            return (
                              <TouchableOpacity
                                key={`hour-${hour}`}
                                style={[
                                  styles.clockNumber,
                                  { 
                                    left, 
                                    top,
                                    backgroundColor: isSelected ? colors.primary : 'transparent' 
                                  }
                                ]}
                                onPress={() => {
                                  // Preserve AM/PM when changing hour
                                  const isPM = selectedHour >= 12;
                                  const newHour = isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour);
                                  setSelectedHour(newHour);
                                  setTimeSelectionMode('minute');
                                }}
                              >
                                <Text style={[{ color: isSelected ? '#fff' : colors.text }]}>{hour}</Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          // Minutes (showing 5-minute intervals)
                          [...Array(12)].map((_, i) => {
                            const minute = i * 5;
                            const angle = minute * 6;
                            const isSelected = Math.abs(selectedMinute - minute) < 3;
                            
                            // Calculate position
                            const radius = 100;
                            const radian = (angle - 90) * (Math.PI / 180);
                            const left = 125 + radius * Math.cos(radian) - 20;
                            const top = 125 + radius * Math.sin(radian) - 20;
                            
                            return (
                              <TouchableOpacity
                                key={`minute-${minute}`}
                                style={[
                                  styles.clockNumber,
                                  { 
                                    left, 
                                    top,
                                    backgroundColor: isSelected ? colors.primary : 'transparent' 
                                  }
                                ]}
                                onPress={() => {
                                  setSelectedMinute(minute);
                                }}
                              >
                                <Text style={[{ color: isSelected ? '#fff' : colors.text }]}>{minute}</Text>
                              </TouchableOpacity>
                            );
                          })
                        )}
                      </View>
                    </View>
                    
                    {/* Action Buttons */}
                    <View style={styles.timePickerActions}>
                      <TouchableOpacity 
                        style={styles.timePickerCancelButton}
                        onPress={() => setShowTimePicker(false)}
                      >
                        <Text style={styles.timePickerCancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.timePickerConfirmButton}
                        onPress={() => {
                          // Create a new date object with the selected time
                          const newTime = new Date();
                          newTime.setHours(selectedHour);
                          newTime.setMinutes(selectedMinute);
                          newTime.setSeconds(0);
                          
                          // Check if the selected time is in the past for today
                          const now = new Date();
                          const isToday = (
                            scheduledDate.getDate() === now.getDate() &&
                            scheduledDate.getMonth() === now.getMonth() &&
                            scheduledDate.getFullYear() === now.getFullYear()
                          );
                          
                          if (isToday && newTime < now) {
                            Alert.alert('Error', 'Cannot schedule Events in the past. Please select a future time.');
                            return;
                          }
                          
                          setScheduledTime(newTime);
                          setShowTimePicker(false);
                        }}
                      >
                        <Text style={styles.timePickerConfirmButtonText}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Due Date </Text>
              <TouchableOpacity
                style={[
                  styles.input, 
                  styles.dateInput, 
                  { 
                    backgroundColor: colors.cardBackground,
                    borderColor: dueDate ? colors.primary : colors.border,
                    borderRadius: 12,
                    paddingVertical: 14
                  }
                ]}
                onPress={() => {
                  setDatePickerMode('due');
                  setShowDatePicker(true);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons 
                    name="event-available" 
                    size={20} 
                    color={colors.primary} 
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ 
                    color: dueDate ? colors.text : colors.textSecondary, 
                    fontSize: 16, 
                    fontWeight: dueDate ? '500' : '400' 
                  }}>
                    {dueDate 
                      ? dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) 
                      : 'Set a due date '
                    }
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              
              {dueDate && (
                <TouchableOpacity
                  style={styles.clearTimeButton}
                  onPress={() => setDueDate(null)}
                >
                  <Text style={styles.clearTimeButtonText}>Clear due date</Text>
                </TouchableOpacity>
              )}
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Repeat Event</Text>
              <View style={[styles.repeatOptionsContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.repeatHeaderRow}>
                  <Text style={[styles.repeatDescription, { color: colors.text }]}>Choose how often this Event should repeat:</Text>
                  <TouchableOpacity 
                    style={styles.infoButton}
                    onPress={() => Alert.alert(
                      'About Recurring Events', 
                      'None: Event occurs only once\n\nWeekly: Event repeats every week on the same weekday\n\nMonthly: Event repeats every month on the same date'
                    )}
                  >
                    <MaterialIcons name="help-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.repeatOptions}>
                  <TouchableOpacity
                    style={[
                      styles.repeatOption,
                      repeatFrequency === 'none' && [styles.activeRepeatOption, { borderColor: colors.primary }]
                    ]}
                    onPress={() => setRepeatFrequency('none')}
                  >
                    <MaterialIcons 
                      name="event-busy" 
                      size={24} 
                      color={repeatFrequency === 'none' ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.repeatOptionText, 
                      { color: repeatFrequency === 'none' ? colors.primary : colors.text }
                    ]}>
                      No Repeat
                    </Text>
                    <Text style={styles.repeatOptionDescription}>
                      One-time event
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.repeatOption,
                      repeatFrequency === 'weekly' && [styles.activeRepeatOption, { borderColor: colors.primary }]
                    ]}
                    onPress={() => setRepeatFrequency('weekly')}
                  >
                    <MaterialIcons 
                      name="event-repeat" 
                      size={24} 
                      color={repeatFrequency === 'weekly' ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.repeatOptionText, 
                      { color: repeatFrequency === 'weekly' ? colors.primary : colors.text }
                    ]}>
                      Weekly
                    </Text>
                    <Text style={styles.repeatOptionDescription}>
                      Same day each week
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.repeatOption,
                      repeatFrequency === 'monthly' && [styles.activeRepeatOption, { borderColor: colors.primary }]
                    ]}
                    onPress={() => setRepeatFrequency('monthly')}
                  >
                    <MaterialIcons 
                      name="date-range" 
                      size={24} 
                      color={repeatFrequency === 'monthly' ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.repeatOptionText, 
                      { color: repeatFrequency === 'monthly' ? colors.primary : colors.text }
                    ]}>
                      Monthly
                    </Text>
                    <Text style={styles.repeatOptionDescription}>
                      Same date each month
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
              <View style={styles.switchContainer}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Enable Reminder</Text>
                <Switch
                  value={notificationEnabled}
                  onValueChange={setNotificationEnabled}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={notificationEnabled ? colors.primary : colors.textSecondary}
                />
              </View>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[
                  styles.input, 
                  styles.textArea, 
                  { 
                    backgroundColor: colors.cardBackground,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter additional details"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
              />
            </ScrollView>
            
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <View style={styles.datePickerActions}>
                <TouchableOpacity 
                  style={styles.datePickerCancelButton}
                  onPress={() => {
                    // Debounce the cancel button
                    if (modalVisible) setModalVisible(false);
                  }}
                >
                  <Text style={styles.datePickerCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.datePickerConfirmButton}
                  disabled={isSaving.current}
                  onPress={handleSaveTask}
                >
                  <Text style={styles.datePickerConfirmButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  inputLabel: {
    ...Typography.caption,
    marginBottom: 4,
    marginTop: Spacing.small,
    color: Colors.textSecondary,
  },
  
  // Date/time picker modal styles
  pickerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerModalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.medium,
    borderBottomWidth: 1,
  },
  pickerModalTitle: {
    ...Typography.subheading,
  },
  
  // Calendar styles
  calendarContainer: {
    margin: Spacing.medium,
    padding: Spacing.medium,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 500, // Prevent excessive height
    overflow: 'hidden', // Prevent content from overflowing
  },
  calendarToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  calendarToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  calendarToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  calendarReloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  calendarToggleText: {
    color: Colors.text,
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  calendarWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 8,
  },
  calendarNavButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  calendarHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarHeaderAction: {
    padding: 8,
    marginLeft: 8,
  },
  calendarMonthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarWeekdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  calendarWeekdayText: {
    width: 40,
    textAlign: 'center',
    fontWeight: '500',
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '400',
  },
  calendarSelectedDay: {
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  calendarTodayDay: {
    borderWidth: 1,
    borderRadius: 20,
    borderColor: 'transparent',
  },
  calendarDayWithTasks: {
    borderWidth: 1,
    borderRadius: 20,
    borderColor: Colors.primary + '50',
    backgroundColor: Colors.primary + '10',
  },
  calendarDayIndicators: {
    flexDirection: 'row',
    marginTop: 4,
  },
  calendarDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 1,
  },
  calendarDayDueIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  recurringIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
  },
  
  // Clock styles
  clockContainer: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 10,
  },
  clockFace: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  clockCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    zIndex: 10,
  },
  clockHand: {
    position: 'absolute',
    height: 2,
    borderRadius: 2,
    top: 125,
    left: 125,
    zIndex: 9,
    transformOrigin: 'left center',
    elevation: 1,
  },
  clockNumber: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    elevation: 1,
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    backgroundColor: '#F8F8F8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  timeDisplayText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  timeDisplaySeparator: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 5,
    color: Colors.primary,
  },
  timeDisplayButtonContainer: {
    padding: 8,
    borderRadius: 8,
  },
  amPmContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 5,
  },
  amPmButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  amPmButtonActive: {
    backgroundColor: Colors.primary,
  },
  amPmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
  amPmButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Custom clock view styles
  clockTimeDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 10,
  },
  clockAmPmButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  clockAmPmButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  timePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  hourHand: {
    position: 'absolute',
    width: 80,
    height: 4,
    borderRadius: 4,
    top: '50%',
    left: '50%',
    marginTop: -2,
    transformOrigin: 'left center',
    zIndex: 8,
  },
  minuteHand: {
    position: 'absolute',
    width: 120,
    height: 2,
    borderRadius: 2,
    top: '50%',
    left: '50%',
    marginTop: -1,
    transformOrigin: 'left center',
    zIndex: 9,
  },
  timeControls: {
    width: '100%',
    marginTop: Spacing.medium,
  },
  timeControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.small,
  },
  timeLabel: {
    ...Typography.body,
    width: 60,
  },
  timeButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeValue: {
    ...Typography.body,
    fontWeight: '600',
    marginHorizontal: Spacing.medium,
    width: 30,
    textAlign: 'center',
  },
  // Removed duplicate styles to fix TypeScript errors
  timePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.medium,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timePickerAction: {
    paddingHorizontal: Spacing.medium,
    paddingVertical: Spacing.small,
    borderRadius: 4,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  datePickerConfirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  datePickerConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  datePickerCancelButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 15,
  },
  datePickerCancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  timePickerCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
  },
  timePickerCancelButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  timePickerConfirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  timePickerConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.medium,
    paddingTop: 50,
    paddingBottom: Spacing.medium,
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...Typography.heading,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: Spacing.medium,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 0,
    marginRight: 22,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  activeFilterButton: {
    backgroundColor: Colors.primary,
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#333333',
    fontWeight: '600',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.large,
  },
  emptyText: {
    ...Typography.body,
    marginTop: Spacing.medium,
    marginBottom: Spacing.large,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  addButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  taskList: {
    padding: Spacing.medium,
  },
  taskItem: {
    borderRadius: 8,
    padding: Spacing.medium,
    marginBottom: Spacing.medium,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  completedTask: {
    opacity: 0.8,
    borderLeftColor: Colors.success,
    borderLeftWidth: 4,
  },
  missedTask: {
    opacity: 0.8,
    borderLeftColor: Colors.error,
    borderLeftWidth: 4,
  },
  dueTask: {
    opacity: 0.8,
    borderLeftColor: Colors.warning,
    borderLeftWidth: 4,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.small,
  },
  taskTitle: {
    ...Typography.subheading,
    flex: 1,
  },
  taskActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  taskDetails: {
    marginTop: 8,
    marginBottom: 12,
  },
  taskDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  taskDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  taskDetailText: {
    ...Typography.caption,
    marginLeft: 4,
  },
  taskDescription: {
    ...Typography.body,
    marginBottom: Spacing.small,
  },
  statusActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.small,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginLeft: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  completeButton: {
    backgroundColor: Colors.primary, // Purple (primary theme color)
  },
  missButton: {
    backgroundColor: '#FF9800', // Solid orange
  },
  resetButton: {
    backgroundColor: '#5C6BC0', // Indigo color
  },
  rescheduleButton: {
    backgroundColor: '#4CAF50', // Light green color
  },
  statusButtonText: {
    color: '#fff',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.medium,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...Typography.subheading,
  },
  modalBody: {
    padding: Spacing.medium,
  },
  repeatDescription: {
    ...Typography.caption,
    marginBottom: 8,
    flex: 1,
  },
  repeatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    padding: Spacing.small,
    marginBottom: Spacing.medium,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearTimeButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearTimeButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  repeatOptions: {
    flexDirection: 'row',
    marginBottom: Spacing.medium,
  },
  repeatOption: {
    flex: 1,
    padding: Spacing.small,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    borderRadius: 4,
  },
  activeRepeatOption: {
    borderWidth: 2,
    backgroundColor: Colors.primary + '10',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.medium,
  },
  switchLabel: {
    ...Typography.body,
  },
  modalFooter: {
    padding: Spacing.medium,
    borderTopWidth: 1,
  },
  infoButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  repeatOptionsContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  repeatOptionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  repeatOptionDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginLeft: 32,
  },
  eventCountBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.primary + 'E6',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  eventCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  floatingActionButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default ScheduleScreen;

