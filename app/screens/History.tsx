// import React, { useState, useEffect, useMemo } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   SectionList,
//   ActivityIndicator,
//   SafeAreaView,
//   StatusBar,
//   ScrollView,
// } from 'react-native';
// import { MaterialIcons } from '@expo/vector-icons';
// import { FIREBASE_AUTH } from '../../FirebaseConfig';
// import { Timestamp } from 'firebase/firestore';
// import { Colors, Typography, Spacing, fontSizes } from '../styles/global';
// import Theme from '../styles/theme';
// import { useNavigation, DrawerActions } from '@react-navigation/native';
// import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
// import { 
//   subscribeToTaskHistory, 
//   TaskHistoryRecord,
// } from '../utils/firebaseService';

// // Extend TaskHistoryRecord to include recurring property
// interface ExtendedTaskHistoryRecord extends TaskHistoryRecord {
//   recurring?: boolean;
// }

// // Define types
// type RootStackParamList = {
//   Home: undefined;
//   History: undefined;
//   Analytics: undefined;
// };

// type HistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// // Helper function to format date as YYYY-MM-DD
// const formatDateString = (date: Date): string => {
//   return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
// };

// // Helper function to format date in a readable format
// const formatDate = (dateStr: string): string => {
//   if (!dateStr) return 'N/A';
//   const date = new Date(dateStr);
//   return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
// };

// // Helper to group history records by date
// const groupByDate = (records: ExtendedTaskHistoryRecord[]) => {
//   const grouped = new Map<string, ExtendedTaskHistoryRecord[]>();
  
//   records.forEach(record => {
//     if (!grouped.has(record.date)) {
//       grouped.set(record.date, []);
//     }
//     grouped.get(record.date)?.push(record);
//   });
  
//   // Convert to array and sort by date (newest first)
//   return Array.from(grouped.entries())
//     .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
//     .map(([date, records]) => ({
//       date,
//       data: records // Changed from 'records' to 'data' for SectionList
//     }));
// };

// // Define styles
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: Colors.background,
//   },
//   timeContainer: {
//     flexDirection: 'column',
//     alignItems: 'flex-end',
//   },
//   taskDate: {
//     fontSize: fontSizes.small,
//     color: Colors.secondary,
//     marginBottom: 2,
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: Spacing.medium,
//     borderBottomWidth: 1,
//     borderBottomColor: Colors.border,
//     backgroundColor: Colors.card,
//   },
//   menuButton: {
//     padding: Theme.Spacing.sm,
//   },
//   title: {
//     ...Typography.heading,
//     color: Theme.Colors.text,
//   },
//   filterScrollContainer: {
//     borderBottomWidth: 1,
//     borderBottomColor: Theme.Colors.border,
//     backgroundColor: Theme.Colors.surface,
//   },
//   filterContainer: {
//     flexDirection: 'row',
//     paddingVertical: Theme.Spacing.sm,
//     paddingHorizontal: Theme.Spacing.md,
//   },
//   filterButton: {
//     paddingVertical: Theme.Spacing.md,
//     paddingHorizontal: Theme.Spacing.sm,
//     borderRadius: 30,
//     marginHorizontal: 4,
//     borderWidth: 1,
//     borderColor: Theme.Colors.border,
//     backgroundColor: Theme.Colors.background,
//     width: 110,
//     height: 45,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   filterButtonActive: {
//     backgroundColor: Theme.Colors.primary,
//     borderColor: Theme.Colors.primary,
//   },
//   filterButtonText: {
//     ...Theme.Typography.bodySmall,
//     fontWeight: 'bold',
//     color: Theme.Colors.text,
//   },
//   filterButtonTextActive: {
//     color: Theme.Colors.textLight,
//     fontWeight: 'bold',
//   },
//   content: {
//     flex: 1,
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   dateHeader: {
//     padding: Theme.Spacing.md,
//     backgroundColor: Theme.Colors.background,
//     borderBottomWidth: 1,
//     borderBottomColor: Theme.Colors.border,
//   },
//   dateText: {
//     ...Typography.subtitle,
//     fontWeight: 'bold',
//     color: Theme.Colors.text,
//   },
//   taskCard: {
//     ...Theme.ComponentStyles.card,
//     marginHorizontal: Theme.Spacing.md,
//     marginTop: Theme.Spacing.md,
//   },
//   recurringTaskItem: {
//     borderLeftWidth: 4,
//     borderLeftColor: Colors.accent,
//   },
//   taskHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: Spacing.small,
//   },
//   taskTitleContainer: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   recurringBadge: {
//     backgroundColor: Colors.accent,
//     borderRadius: 12,
//     paddingHorizontal: 8,
//     paddingVertical: 2,
//     marginLeft: 8,
//   },
//   recurringBadgeText: {
//     color: Colors.white,
//     fontSize: fontSizes.small,
//     fontWeight: 'bold',
//   },
//   taskTitle: {
//     ...Typography.subtitle,
//     fontWeight: 'bold',
//     flex: 1,
//     color: Colors.text,
//   },
//   taskXP: {
//     ...Typography.caption,
//     color: Colors.success,
//     fontWeight: 'bold',
//   },
//   taskDescription: {
//     ...Typography.body,
//     marginBottom: Spacing.small,
//     color: Colors.text,
//   },
//   taskCategory: {
//     ...Typography.caption,
//     color: Colors.muted,
//     marginBottom: Spacing.small,
//   },
//   taskMeta: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingTop: Spacing.small,
//     borderTopWidth: 1,
//     borderTopColor: Colors.border + '40',
//   },
//   taskAction: {
//     ...Typography.caption,
//     color: Colors.primary,
//   },
//   taskTimestamp: {
//     ...Typography.caption,
//     color: Colors.muted,
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: Spacing.large,
//   },
//   emptyText: {
//     ...Typography.body,
//     color: Colors.muted,
//     textAlign: 'center',
//     marginBottom: Spacing.medium,
//   },
//   emptyButton: {
//     backgroundColor: Colors.primary,
//     paddingVertical: Spacing.small,
//     paddingHorizontal: Spacing.medium,
//     borderRadius: 20,
//   },
//   emptyButtonText: {
//     ...Typography.body,
//     color: Colors.white,
//   }
// });

// const History = () => {
//   const navigation = useNavigation<HistoryScreenNavigationProp>();
//   const user = FIREBASE_AUTH.currentUser;
//   const [loading, setLoading] = useState(true);
//   const [history, setHistory] = useState<ExtendedTaskHistoryRecord[]>([]);
//   const [filter, setFilter] = useState<'all' | 'completed' | 'created' | 'updated' | 'recurring'>('all');
  
//   // Load task history when component mounts
//   useEffect(() => {
//     if (!user) return;
    
//     setLoading(true);
    
//     // Get start date (account creation date or 90 days ago, whichever is more recent)
//     const creationDate = new Date(user.metadata.creationTime || Date.now());
//     const ninetyDaysAgo = new Date();
//     ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
//     const startDate = creationDate > ninetyDaysAgo ? creationDate : ninetyDaysAgo;
    
//     // Determine which actions to include based on filter
//     let actions: Array<TaskHistoryRecord['action']> | undefined;
//     let filterOptions: any = {};
    
//     switch (filter) {
//       case 'completed':
//         actions = ['completed', 'uncompleted'];
//         break;
//       case 'created':
//         actions = ['created'];
//         break;
//       case 'updated':
//         actions = ['updated', 'deleted'];
//         break;
//       case 'recurring':
//         // For recurring filter, we want all actions but only for recurring tasks
//         filterOptions.recurring = true;
//         break;
//       default:
//         actions = undefined; // All actions
//     }
    
//     // Subscribe to task history with enhanced filtering
//     const unsubscribe = subscribeToTaskHistory(
//       {
//         startDate: startDate,
//         endDate: null, // No end date (up to current date)
//         actions: actions,
//         limit: 100, // Reasonable limit for performance
//         ...filterOptions // Add any additional filter options (like recurring)
//       },
//       (historyRecords) => {
//         setHistory(historyRecords);
//         setLoading(false);
//       },
//       (error) => {
//         console.error('Error in task history listener:', error);
//         setLoading(false);
//       }
//     );
    
//     return () => {
//       unsubscribe();
//     };
//   }, [user, filter]);
  
//   // Group history records by date
//   const groupedHistory = useMemo(() => {
//     return groupByDate(history);
//   }, [history]);

//   // Render a task history item
//   const renderTaskItem = ({ item }: { item: ExtendedTaskHistoryRecord }) => {
//     // Determine action color
//     let actionColor = Theme.Colors.primary;
//     switch (item.action) {
//       case 'completed':
//         actionColor = Theme.Colors.success;
//         break;
//       case 'uncompleted':
//         actionColor = Theme.Colors.warning;
//         break;
//       case 'deleted':
//         actionColor = Theme.Colors.error;
//         break;
//       default:
//         actionColor = Theme.Colors.primary;
//     }

//     return (
//       <View style={[styles.taskCard, item.recurring ? styles.recurringTaskItem : {}]}>
//         <View style={styles.taskHeader}>
//           <View style={styles.taskTitleContainer}>
//             <Text style={styles.taskTitle}>{item.title}</Text>
//             {item.recurring && (
//               <View style={styles.recurringBadge}>
//                 <Text style={styles.recurringBadgeText}>Daily</Text>
//               </View>
//             )}
//           </View>
//           <Text style={styles.taskXP}>+{item.xp} XP</Text>
//         </View>
        
//         {item.description ? (
//           <Text style={styles.taskDescription}>{item.description}</Text>
//         ) : null}
        
//         {item.category ? (
//           <Text style={styles.taskCategory}>Category: {item.category}</Text>
//         ) : null}
        
//         <View style={styles.taskMeta}>
//           <Text style={[styles.taskAction, { color: actionColor }]}>
//             {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
//           </Text>
//           <View style={styles.timeContainer}>
//             <Text style={styles.taskDate}>
//               {item.timestamp.toDate().toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'})}
//             </Text>
//             <Text style={styles.taskTimestamp}>
//               {item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//             </Text>
//           </View>
//         </View>
//       </View>
//     );
//   };
  
//   // Render a section header (date)
//   const renderSectionHeader = ({ section }: { section: { date: string, data: ExtendedTaskHistoryRecord[] } }) => (
//     <View style={styles.dateHeader}>
//       <Text style={styles.dateText}>{formatDate(section.date)}</Text>
//     </View>
//   );
  
//   // Render empty state
//   const renderEmpty = () => (
//     <View style={styles.emptyContainer}>
//       <Text style={styles.emptyText}>
//         No task history found for the selected filter.
//       </Text>
//       <TouchableOpacity 
//         style={styles.emptyButton}
//         onPress={() => setFilter('all')}
//       >
//         <Text style={styles.emptyButtonText}>View All History</Text>
//       </TouchableOpacity>
//     </View>
//   );
  
//   // Convert grouped history to sections for SectionList
//   const sections = groupedHistory.map(({ date, data }) => ({
//     date,
//     data, // This is already named 'data' from the groupByDate function
//   }));
  
//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
//       {/* Header */}
//       <View style={Theme.ComponentStyles.header}>
//         <TouchableOpacity
//           style={Theme.ComponentStyles.headerIcon}
//           onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
//         >
//           <MaterialIcons name="menu" size={24} color={Theme.Colors.primary} />
//         </TouchableOpacity>
//         <Text style={Theme.ComponentStyles.headerTitle}>History</Text>
//         <View style={{ width: 40 }} />
//       </View>
      
//       {/* Filter buttons - with horizontal scrolling */}
//       <ScrollView 
//         horizontal 
//         showsHorizontalScrollIndicator={false} 
//         style={styles.filterScrollContainer}
//         contentContainerStyle={styles.filterContainer}
//         decelerationRate="fast"
//         snapToInterval={118}
//         snapToAlignment="center"
//         contentInset={{left: 0, right: 0}}
//       >
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'all' && styles.filterButtonActive
//           ]}
//           onPress={() => setFilter('all')}
//         >
//           <Text style={[
//             styles.filterButtonText,
//             filter === 'all' && styles.filterButtonTextActive
//           ]}>All</Text>
//         </TouchableOpacity>
        
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'completed' && styles.filterButtonActive
//           ]}
//           onPress={() => setFilter('completed')}
//         >
//           <Text style={[
//             styles.filterButtonText,
//             filter === 'completed' && styles.filterButtonTextActive
//           ]}>Completed</Text>
//         </TouchableOpacity>
        
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'created' && styles.filterButtonActive
//           ]}
//           onPress={() => setFilter('created')}
//         >
//           <Text style={[
//             styles.filterButtonText,
//             filter === 'created' && styles.filterButtonTextActive
//           ]}>Created</Text>
//         </TouchableOpacity>
        
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'updated' && styles.filterButtonActive
//           ]}
//           onPress={() => setFilter('updated')}
//         >
//           <Text style={[
//             styles.filterButtonText,
//             filter === 'updated' && styles.filterButtonTextActive
//           ]}>Updated</Text>
//         </TouchableOpacity>
        
//         <TouchableOpacity
//           style={[
//             styles.filterButton,
//             filter === 'recurring' && styles.filterButtonActive
//           ]}
//           onPress={() => setFilter('recurring')}
//         >
//           <Text style={[
//             styles.filterButtonText,
//             filter === 'recurring' && styles.filterButtonTextActive
//           ]}>Recurring</Text>
//         </TouchableOpacity>
//       </ScrollView>
      
//       {/* Content */}
//       <View style={styles.content}>
//         {loading ? (
//           <View style={styles.loadingContainer}>
//             <ActivityIndicator size="large" color={Colors.primary} />
//           </View>
//         ) : (
//           <SectionList
//             sections={sections}
//             renderItem={renderTaskItem}
//             keyExtractor={(item) => item.id}
//             contentContainerStyle={{ paddingBottom: Spacing.large }}
//             ListEmptyComponent={renderEmpty}
//             renderSectionHeader={renderSectionHeader}
//           />
//         )}
//       </View>
//     </SafeAreaView>
//   );
// };

// export default History;


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
} from '../utils/firebaseService';

interface ExtendedTaskHistoryRecord extends TaskHistoryRecord {
  recurring?: boolean;
}

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

const groupByDate = (records: ExtendedTaskHistoryRecord[]) => {
  const grouped = new Map<string, ExtendedTaskHistoryRecord[]>();
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
  const [filter, setFilter] = useState<'all' | 'completed' | 'created' | 'updated' | 'recurring'>('all');

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const creationDate = new Date(user.metadata.creationTime || Date.now());
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate = creationDate > ninetyDaysAgo ? creationDate : ninetyDaysAgo;

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

  const groupedHistory = useMemo(() => groupByDate(history), [history]);

  useEffect(() => {
    // Only scroll if we have sections with items
    if (groupedHistory.length > 0 && groupedHistory[0].data.length > 0) {
      listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true });
    }
  }, [filter, groupedHistory]);

  const renderTaskItem = ({ item }: { item: ExtendedTaskHistoryRecord }) => {
    const colorMap = {
      completed: Theme.Colors.success,
      uncompleted: Theme.Colors.warning,
      deleted: Theme.Colors.error,
      default: Theme.Colors.primary,
    };
    const actionColor = colorMap[item.action as keyof typeof colorMap] || colorMap.default;

    return (
      <View style={[styles.taskCard, item.recurring ? styles.recurringTaskItem : {}]}>
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

        <View style={styles.taskMeta}>
          <Text style={[styles.taskAction, { color: actionColor }]}>
            {item.action.charAt(0).toUpperCase() + item.action.slice(1)}
          </Text>
          <View style={styles.timeContainer}>
            {item.timestamp ? (
              <>
                <Text style={styles.taskDate}>
                  {item.timestamp.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text style={styles.taskTimestamp}>
                  {item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      <Text style={styles.emptyText}>No task history found for the “{filter}” filter.</Text>
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
