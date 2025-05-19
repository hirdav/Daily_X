import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH } from '../../FirebaseConfig';
import { Colors, Typography, Spacing, fontSizes } from '../styles/global';
import Theme from '../styles/theme';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  subscribeToTaskHistory,
  TaskHistoryRecord,
  subscribeToTasks,
  Task,
} from '../utils/firebaseService';
import { MissedTaskOccurrence, generateAllMissedOccurrences } from '../utils/missedTasksUtils';

interface ExtendedTaskHistoryRecord extends TaskHistoryRecord {
  recurring?: boolean;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    completedAt?: any;
  }>;
}

// Interface for incomplete tasks
interface IncompleteTask {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  category?: string;
  xp: number;
  date: string;
  userId: string;
  action: 'incomplete';
  recurring?: boolean;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
  timestamp: any;
}

// Type that combines both current incomplete tasks and historical missed occurrences
type HistoryItem = ExtendedTaskHistoryRecord | IncompleteTask | MissedTaskOccurrence;

type RootStackParamList = {
  Home: undefined;
  History: undefined;
};

type HistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper function to format date as YYYY-MM-DD
const formatDateString = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const groupByDate = (records: (ExtendedTaskHistoryRecord | IncompleteTask)[]) => {
  const grouped = new Map<string, (ExtendedTaskHistoryRecord | IncompleteTask)[]>();
  records.forEach(record => {
    if (!grouped.has(record.date)) {
      grouped.set(record.date, []);
    }
    grouped.get(record.date)?.push(record);
  });

  return Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, data]) => ({ date, data }));
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  timeContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  taskDate: {
    fontSize: fontSizes.small,
    color: Colors.secondary,
    marginBottom: 2,
  },
  header: {
    ...Theme.ComponentStyles.header,
  },
  filterScrollContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.Colors.border,
    backgroundColor: Theme.Colors.surface,
    paddingVertical: 5, // Add padding to ensure buttons aren't cut off
  },
  filterContainer: {
    flexDirection: 'row',
    paddingVertical: Theme.Spacing.sm,
    paddingHorizontal: 8,
  },
  filterButton: {
    paddingVertical: Theme.Spacing.sm,
    paddingHorizontal: Theme.Spacing.md,
    borderRadius: 30,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: Theme.Colors.border,
    backgroundColor: Theme.Colors.background,
    minWidth: 110, // Use minWidth instead of fixed width to accommodate text
    height: 40, // Slightly reduce height
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: Theme.Colors.primary,
    borderColor: Theme.Colors.primary,
  },
  filterButtonText: {
    ...Theme.Typography.bodySmall,
    fontWeight: 'bold',
    color: Theme.Colors.text,
  },
  filterButtonTextActive: {
    color: Theme.Colors.textLight,
    fontWeight: 'bold',
  },
  subtaskContainer: {
    marginTop: Theme.Spacing.sm,
    marginLeft: Theme.Spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: Theme.Colors.border,
    paddingLeft: Theme.Spacing.md,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.Spacing.xs,
  },
  subtaskTitle: {
    ...Theme.Typography.bodySmall,
    color: Theme.Colors.text,
    flex: 1,
  },
  subtaskStatus: {
    ...Theme.Typography.captionSmall,
    color: Theme.Colors.muted,
  },
  incompleteTaskItem: {
    borderLeftWidth: 4,
    borderLeftColor: Theme.Colors.warning,
  },
  incompleteAction: {
    color: Theme.Colors.warning,
  },
  content: {
    flex: 1,
    marginTop: 0, // Remove any extra margin at the top
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateHeader: {
    padding: Theme.Spacing.md,
    backgroundColor: Theme.Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Theme.Colors.border,
  },
  dateText: {
    ...Typography.subtitle,
    fontWeight: 'bold',
    color: Theme.Colors.text,
  },
  taskCard: {
    ...Theme.ComponentStyles.card,
    marginHorizontal: Theme.Spacing.md,
    marginTop: Theme.Spacing.md,
  },
  recurringTaskItem: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.small,
  },
  taskTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  recurringBadgeText: {
    color: Colors.white,
    fontSize: fontSizes.small,
    fontWeight: 'bold',
  },
  taskTitle: {
    ...Typography.subtitle,
    fontWeight: 'bold',
    flex: 1,
    color: Colors.text,
  },
  taskXP: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: 'bold',
  },
  taskDescription: {
    ...Typography.body,
    marginBottom: Spacing.small,
    color: Colors.text,
  },
  taskCategory: {
    ...Typography.caption,
    color: Colors.muted,
    marginBottom: Spacing.small,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.small,
    borderTopWidth: 1,
    borderTopColor: Colors.border + '40',
  },
  taskAction: {
    ...Typography.caption,
    color: Colors.primary,
  },
  taskTimestamp: {
    ...Typography.caption,
    color: Colors.muted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.large,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: Spacing.medium,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.medium,
    borderRadius: 20,
  },
  emptyButtonText: {
    ...Typography.body,
    color: Colors.white,
  },
});

const History = () => {
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  const user = FIREBASE_AUTH.currentUser;
  const listRef = useRef<SectionList>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ExtendedTaskHistoryRecord[]>([]);
  const [incompleteTasks, setIncompleteTasks] = useState<IncompleteTask[]>([]);
  const [missedOccurrences, setMissedOccurrences] = useState<MissedTaskOccurrence[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'created' | 'updated' | 'recurring' | 'incomplete'>('all');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const creationDate = new Date(user.metadata.creationTime || Date.now());
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate = creationDate > ninetyDaysAgo ? creationDate : ninetyDaysAgo;
    
    // Don't fetch task history for incomplete filter
    if (filter === 'incomplete') {
      setLoading(false);
      return () => {};
    }

    let actions: Array<TaskHistoryRecord['action']> | undefined;
    let filterOptions: any = {};

    switch (filter) {
      case 'completed':
        actions = ['completed', 'uncompleted'];
        break;
      case 'created':
        actions = ['created'];
        break;
      case 'updated':
        actions = ['updated', 'deleted'];
        break;
      case 'recurring':
        filterOptions.recurring = true;
        break;
      default:
        actions = undefined;
    }

    const unsubscribe = subscribeToTaskHistory(
      { startDate, endDate: null, actions, limit: 100, ...filterOptions },
      (records) => {
        setHistory(records);
        setLoading(false);
      },
      (error) => {
        console.error('Error in task history listener:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, filter]);

  const groupedHistory = useMemo(() => {
    // For the incomplete filter, use both current incomplete tasks and missed occurrences
    if (filter === 'incomplete') {
      return groupByDate([...missedOccurrences]);
    }
    // For all other filters, use history records
    return groupByDate(history);
  }, [history, missedOccurrences, filter]);

  // Load missed task occurrences
  useEffect(() => {
    if (!user || filter !== 'incomplete') return;
    
    setLoading(true);
    
    // Subscribe to all tasks to generate missed occurrences
    const unsubscribe = subscribeToTasks(
      (tasks) => {
        // Generate missed occurrences for all tasks
        const allMissedOccurrences = generateAllMissedOccurrences(tasks);
        
        // Sort missed occurrences by date (newest first)
        const sortedMissedOccurrences = [...allMissedOccurrences].sort((a, b) => {
          return b.date.localeCompare(a.date);
        });
        
        setMissedOccurrences(sortedMissedOccurrences);
        setLoading(false);
      },
      (error) => {
        console.error('Error in tasks listener:', error);
        setLoading(false);
      }
    );
    
    return () => {
      unsubscribe();
    };
  }, [user, filter]);
  
  useEffect(() => {
    // Only scroll if we have sections with items
    if (groupedHistory.length > 0 && groupedHistory[0].data.length > 0) {
      listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
    }
  }, [filter, groupedHistory]);

  const renderTaskItem = ({ item }: { item: HistoryItem }) => {
    const colorMap = {
      completed: Theme.Colors.success,
      uncompleted: Theme.Colors.warning,
      deleted: Theme.Colors.error,
      incomplete: Theme.Colors.warning,
      default: Theme.Colors.primary,
    };
    const actionColor = colorMap[item.action as keyof typeof colorMap] || colorMap.default;

    const isIncomplete = item.action === 'incomplete';
    const cardStyle = [
      styles.taskCard, 
      item.recurring ? styles.recurringTaskItem : {},
      isIncomplete ? styles.incompleteTaskItem : {}
    ];
    
    return (
      <View style={cardStyle}>
        <View style={styles.taskHeader}>
          <View style={styles.taskTitleContainer}>
            <Text style={styles.taskTitle}>{item.title}</Text>
            {item.recurring && (
              <View style={styles.recurringBadge}>
                <Text style={styles.recurringBadgeText}>Daily</Text>
              </View>
            )}
          </View>
          <Text style={styles.taskXP}>+{item.xp} XP</Text>
        </View>

        {item.description && <Text style={styles.taskDescription}>{item.description}</Text>}
        
        {/* Render subtasks for incomplete tasks */}
        {isIncomplete && item.subtasks && item.subtasks.length > 0 && (
          <View style={styles.subtaskContainer}>
            {item.subtasks.map(subtask => (
              <View key={subtask.id} style={styles.subtaskItem}>
                <Text style={styles.subtaskTitle}>{subtask.title}</Text>
                <Text style={styles.subtaskStatus}>
                  {subtask.completed ? 'Completed' : 'Incomplete'}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.taskMeta}>
          <Text style={[styles.taskAction, { color: actionColor }]}>
            {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
          </Text>
          <View style={styles.timeContainer}>
            {item.timestamp ? (
              <>
                <Text style={styles.taskDate}>
                  {typeof item.timestamp.toDate === 'function' 
                    ? item.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                    : (item.timestamp instanceof Date 
                        ? item.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}
                </Text>
                <Text style={styles.taskTimestamp}>
                  {typeof item.timestamp.toDate === 'function' 
                    ? item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : (item.timestamp instanceof Date 
                        ? item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                </Text>
              </>
            ) : (
              <Text style={styles.taskTimestamp}>Unknown time</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.dateHeader}>
      <Text style={styles.dateText}>{formatDate(section.date)}</Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{filter === 'incomplete' ? 'No missed task occurrences found.' : `No task history found for the "${filter}" filter.`}</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={() => setFilter('all')}>
        <Text style={styles.emptyButtonText}>View All History</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFilterButton = (label: string, key: typeof filter) => (
    <TouchableOpacity
      key={key}
      style={[styles.filterButton, filter === key && styles.filterButtonActive]}
      onPress={() => setFilter(key)}
    >
      <Text style={[styles.filterButtonText, filter === key && styles.filterButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialIcons name="menu" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
        <Text style={Theme.ComponentStyles.headerTitle}>History</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: Theme.Spacing.sm}}>
          {renderFilterButton('All', 'all')}
          {renderFilterButton('Completed', 'completed')}
          {renderFilterButton('Created', 'created')}
          {renderFilterButton('Updated', 'updated')}
          {renderFilterButton('Recurring', 'recurring')}
          {renderFilterButton('Missed', 'incomplete')}
        </ScrollView>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <SectionList
            ref={listRef}
            sections={groupedHistory}
            renderItem={renderTaskItem}
            keyExtractor={(item) => `${item.date}-${item.id}`}
            contentContainerStyle={{ paddingBottom: Spacing.large, paddingTop: 5 }}
            stickySectionHeadersEnabled={true}
            ListEmptyComponent={renderEmpty}
            renderSectionHeader={renderSectionHeader}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default History;
