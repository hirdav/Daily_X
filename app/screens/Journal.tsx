import React, { useEffect, useState, useRef } from 'react';
import { UIManager, findNodeHandle } from 'react-native';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  TouchableOpacity,
  Animated,
  Easing,
  Modal,
  Pressable,
  Platform,
  Dimensions
} from 'react-native';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import moment from 'moment';
import { Colors, Typography, Spacing, GlobalStyles } from '../styles/global';
import Theme from '../styles/theme';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import JournalExportButton from '../components/JournalExportButton';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-chart-kit';

type RootStackParamList = {
  Home: undefined;
  Journal: undefined;
};

type JournalScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Define valid Feather icon names for TypeScript
type FeatherIconName = 'sun' | 'minus' | 'cloud-rain' | 'zap' | 'moon' | 'mic';

interface Mood {
  emoji: string;
  label: string;
  color: string;
  icon: FeatherIconName;
}

const moods: Mood[] = [
  { emoji: '😄', label: 'Happy', color: '#48BB78', icon: 'sun' },
  { emoji: '😐', label: 'Neutral', color: '#718096', icon: 'minus' },
  { emoji: '😔', label: 'Low', color: '#4299E1', icon: 'cloud-rain' },
  { emoji: '😠', label: 'Frustrated', color: '#F56565', icon: 'zap' },
  { emoji: '😴', label: 'Tired', color: '#9F7AEA', icon: 'moon' },
];

interface JournalEntry {
  thought?: string;
  entry?: string;
  mood?: string;
  timestamp: Date;
  editTimestamp?: Date;
  isEdited?: boolean;
}

interface MoodData {
  date: string;
  mood: string;
}

const Journal = () => {
  // State for edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editThought, setEditThought] = useState('');
  const [editEntry, setEditEntry] = useState('');
  const [editMood, setEditMood] = useState('');
  const [selectedEntryRef, setSelectedEntryRef] = useState('');
  const pastEntriesSectionRef = useRef<View>(null);
  
  // Load a specific date's journal entry
  const loadSpecificDate = (date: string) => {
    // Store the reference to this entry for highlighting
    setSelectedEntryRef(date);
    
    // Close the mood history view
    setShowMoodHistory(false);
    
    const scrollToEntry = async () => {
      try {
        // Find the entry in the history array
        const entryIndex = history.findIndex(h => h.date === date);
        
        if (entryIndex === -1) return;
        
        // Scroll to the past entries section first
        setTimeout(() => {
          if (pastEntriesSectionRef.current) {
            const scrollViewNode = findNodeHandle(scrollViewRef.current);
            const pastEntriesNode = findNodeHandle(pastEntriesSectionRef.current);
            
            if (scrollViewNode && pastEntriesNode) {
              UIManager.measure(pastEntriesNode, (x, y, width, height, pageX, pageY) => {
                if (scrollViewRef.current) {
                  // Calculate offset to scroll to the specific entry
                  // Approximate the position based on entry index
                  const entryOffset = entryIndex * 200; // Approximate height of each entry
                  scrollViewRef.current.scrollTo({ 
                    y: pageY + entryOffset, 
                    animated: true 
                  });
                }
              });
            }
          }
        }, 100);
      } catch (error) {
        console.error('Error navigating to journal entry:', error);
        Alert.alert('Error', 'Could not navigate to the journal entry.');
      }
    };
    
    scrollToEntry();
  };
  // Open edit modal for a specific journal entry
  const openEditModal = async (date: string) => {
    try {
      if (!user) return;
      
      const docRef = doc(FIREBASE_DB, 'users', user.uid, 'journal', date);
      const snapshot = await getDoc(docRef);
      
      if (snapshot.exists()) {
        const data = snapshot.data() as JournalEntry;
        setEditDate(date);
        setEditThought(data.thought || '');
        setEditEntry(data.entry || '');
        setEditMood(data.mood || '');
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error loading journal entry for editing:', error);
      Alert.alert('Error', 'Could not load the journal entry for editing.');
    }
  };
  
  // Save edited journal entry
  const saveEditedEntry = async () => {
    try {
      if (!user || !editDate) return;
      
      const now = new Date();
      const docRef = doc(FIREBASE_DB, 'users', user.uid, 'journal', editDate);
      
      // Get the original entry first to preserve the original timestamp
      const snapshot = await getDoc(docRef);
      let originalTimestamp = now;
      
      if (snapshot.exists()) {
        const data = snapshot.data() as JournalEntry;
        originalTimestamp = data.timestamp;
      }
      
      await setDoc(docRef, {
        thought: editThought,
        entry: editEntry,
        mood: editMood, // Keeping the original mood
        timestamp: originalTimestamp, // Keep original creation timestamp
        editTimestamp: now, // Add edit timestamp
        isEdited: true // Flag to show this entry was edited
      }, { merge: true });
      
      setShowEditModal(false);
      Alert.alert('Success', 'Your journal entry has been updated.');
      
      // Refresh history
      loadHistory();
    } catch (error) {
      console.error('Error saving edited journal entry:', error);
      Alert.alert('Error', 'Failed to save your edited journal entry.');
    }
  };
  
  // Calculate mood statistics for trends and patterns
  const calculateMoodStats = () => {
    // Default values
    const defaultStats = {
      totalEntries: moodHistory.length,
      topMood: { emoji: '😐', label: 'Neutral', count: 0 },
      streak: 0,
      trend: 0
    };
    
    if (moodHistory.length === 0) return defaultStats;
    
    // Count occurrences of each mood
    const moodCounts: {[key: string]: {emoji: string, label: string, count: number}} = {};
    
    moodHistory.forEach(entry => {
      const moodInfo = moods.find(m => m.label === entry.mood);
      if (moodInfo) {
        if (!moodCounts[moodInfo.label]) {
          moodCounts[moodInfo.label] = { emoji: moodInfo.emoji, label: moodInfo.label, count: 0 };
        }
        moodCounts[moodInfo.label].count++;
      }
    });
    
    // Find the most common mood
    let topMood = { emoji: '😐', label: 'Neutral', count: 0 };
    Object.values(moodCounts).forEach(mood => {
      if (mood.count > topMood.count) {
        topMood = mood;
      }
    });
    
    // Calculate current streak
    let streak = 0;
    const today = moment().startOf('day');
    const sortedDates = [...moodHistory]
      .sort((a, b) => moment(b.date).diff(moment(a.date)))
      .map(entry => moment(entry.date).startOf('day'));
    
    // Check if there's an entry for today
    if (sortedDates.length > 0 && sortedDates[0].isSame(today)) {
      streak = 1;
      
      // Count consecutive days backward from today
      for (let i = 1; i < sortedDates.length; i++) {
        const expectedDate = moment(today).subtract(i, 'days');
        const entryDate = sortedDates[i];
        
        if (entryDate.isSame(expectedDate)) {
          streak++;
        } else {
          break;
        }
      }
    }
    
    // Calculate trend (comparing current week to previous week)
    const thisWeekCount = moodHistory.filter(entry => {
      const entryDate = moment(entry.date);
      return entryDate.isAfter(moment().subtract(7, 'days'));
    }).length;
    
    const lastWeekCount = moodHistory.filter(entry => {
      const entryDate = moment(entry.date);
      return entryDate.isAfter(moment().subtract(14, 'days')) && 
             entryDate.isBefore(moment().subtract(7, 'days'));
    }).length;
    
    const trend = thisWeekCount - lastWeekCount;
    
    return {
      totalEntries: moodHistory.length,
      topMood,
      streak,
      trend
    };
  };
  
  // Helper function to group mood history by month
  const groupMoodsByMonth = () => {
    const grouped: { month: string; moods: MoodData[] }[] = [];
    
    console.log('Mood history length:', moodHistory.length);
    
    if (moodHistory.length === 0) {
      // Add a dummy month with dummy data for testing if no real data exists
      const today = moment();
      const dummyMoods: MoodData[] = [];
      
      // Create 7 days of dummy data
      for (let i = 0; i < 7; i++) {
        const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
        dummyMoods.push({
          date,
          mood: moods[Math.floor(Math.random() * moods.length)].label
        });
      }
      
      return [{
        month: today.format('MMMM YYYY'),
        moods: dummyMoods
      }];
    }
    
    // Sort mood history by date (newest first)
    const sortedMoods = [...moodHistory].sort((a, b) => 
      moment(b.date).diff(moment(a.date))
    );
    
    sortedMoods.forEach(mood => {
      const monthYear = moment(mood.date).format('MMMM YYYY');
      let monthGroup = grouped.find(g => g.month === monthYear);
      
      if (!monthGroup) {
        monthGroup = { month: monthYear, moods: [] };
        grouped.push(monthGroup);
      }
      
      monthGroup.moods.push(mood);
    });
    
    // Sort moods within each month by date (newest first)
    grouped.forEach(group => {
      group.moods.sort((a, b) => moment(b.date).diff(moment(a.date)));
    });
    
    console.log('Grouped mood history:', JSON.stringify(grouped));
    return grouped;
  };
  const navigation = useNavigation<JournalScreenNavigationProp>();
  const user = FIREBASE_AUTH.currentUser;
  const todayKey = moment().format('YYYY-MM-DD');
  const scrollViewRef = useRef<ScrollView>(null);
  const [mood, setMood] = useState('');
  const [thought, setThought] = useState('');
  const [entry, setEntry] = useState('');
  const [history, setHistory] = useState<(JournalEntry & { date: string })[]>([]);
  const [moodHistory, setMoodHistory] = useState<MoodData[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [theme, setTheme] = useState('light');
  const [showVoiceInput, setShowVoiceInput] = useState(false);
  const [showMoodHistory, setShowMoodHistory] = useState(false);
  const [audioReflection, setAudioReflection] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [expandedEntries, setExpandedEntries] = useState<{[key: string]: boolean}>({});
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  // Animation values
  const moodAnimations = useRef(moods.map(() => new Animated.Value(1))).current;
  const moodScales = useRef(moods.map(() => new Animated.Value(1))).current;
  const moodHistoryHeight = useRef(new Animated.Value(0)).current;
  const moodHistoryOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    
    loadTodayEntry();
    
    // Setup listeners and store their cleanup functions
    const unsubscribeHistory = loadHistory();
    const unsubscribeMoodHistory = loadMoodHistory();
    
    // Clean up listeners when component unmounts or user changes
    return () => {
      unsubscribeHistory && unsubscribeHistory();
      unsubscribeMoodHistory && unsubscribeMoodHistory();
    };
  }, [user]);
  
  // Function to animate mood selection
  const animateMoodSelection = (index: number) => {
    // Reset all animations
    moodAnimations.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.bounce
      }).start();
      
      Animated.timing(moodScales[i], {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }).start();
    });
    
    // Animate the selected mood
    Animated.sequence([
      Animated.timing(moodScales[index], {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(moodScales[index], {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
    
    // Pulse animation for the selected mood
    Animated.loop(
      Animated.sequence([
        Animated.timing(moodAnimations[index], {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(moodAnimations[index], {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    ).start();
  };

  const loadTodayEntry = async () => {
    const docRef = doc(FIREBASE_DB, 'users', user!.uid, 'journal', todayKey);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      const data = snapshot.data() as JournalEntry;
      setThought(data.thought || '');
      setEntry(data.entry || '');
      setMood(data.mood || '');
    }
  };

  const loadHistory = () => {
    if (!user) return () => {};
    
    try {
      const journalRef = collection(FIREBASE_DB, 'users', user.uid, 'journal');
      const journalQuery = query(journalRef, orderBy('timestamp', 'desc'), limit(10));
      return onSnapshot(journalQuery, (snapshot) => {
        const past = snapshot.docs
          .map(doc => ({
            date: doc.id,
            ...(doc.data() as JournalEntry)
          }))
          .sort((a, b) => moment(b.date).diff(moment(a.date)));
        setHistory(past);
      }, (error) => {
        console.error('Error in journal history listener:', error);
        // If we get permission errors, it might be because the user logged out
        if (error.code === 'permission-denied') {
          setHistory([]);
        }
      });
    } catch (error) {
      console.error('Error setting up journal history listener:', error);
      return () => {};
    }
  };
  
  const loadMoodHistory = () => {
    if (!user) return () => {};
    
    try {
      const journalRef = collection(FIREBASE_DB, 'users', user.uid, 'journal');
      // Increased the limit to show more historical data
      const journalQuery = query(journalRef, orderBy('timestamp', 'desc'), limit(60));
      return onSnapshot(journalQuery, (snapshot) => {
        console.log('Journal entries found:', snapshot.docs.length);
        
        const moodData: MoodData[] = [];
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('Journal entry:', doc.id, data.mood ? data.mood : 'No mood');
          if (data.mood) {
            moodData.push({
              date: doc.id,
              mood: data.mood
            });
          }
        });
        
        console.log('Mood data collected:', moodData.length);
        setMoodHistory(moodData);
        
        // Force a re-render if we have mood data but it's not showing
        if (moodData.length > 0) {
          setShowMoodHistory(true);
        }
      }, (error) => {
        console.error('Error in mood history listener:', error);
        // If we get permission errors, it might be because the user logged out
        if (error.code === 'permission-denied') {
          setMoodHistory([]);
        }
      });
    } catch (error) {
      console.error('Error setting up mood history listener:', error);
      return () => {};
    }
  };

  const saveEntry = async () => {
    if (!thought.trim() && !entry.trim()) {
      Alert.alert('Error', 'Please enter either a thought or journal entry.');
      return;
    }
    
    // Ensure mood is set, default to Neutral if not selected
    const moodToSave = mood || 'Neutral';

    try {
      const docRef = doc(FIREBASE_DB, 'users', user!.uid, 'journal', todayKey);
      await setDoc(docRef, {
        thought,
        entry,
        mood: moodToSave,
        timestamp: new Date()
      });
      Alert.alert('Success', 'Your journal entry has been saved.');
    } catch (err) {
      console.error('Error saving journal:', err);
      Alert.alert('Error', 'Failed to save journal entry.');
    }
  };

  if (!user) return null;

  const selectedMoodColor = moods.find(m => m.label === mood)?.color || Colors.primary;

  return (
    <View style={Theme.ComponentStyles.container}>
      <View style={Theme.ComponentStyles.header}>
        <TouchableOpacity
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialIcons name="menu" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
        <Text style={Theme.ComponentStyles.headerTitle}>Journal</Text>
        <TouchableOpacity 
          style={Theme.ComponentStyles.headerIcon}
          onPress={() => setShowOptionsMenu(true)}
        >
          <MaterialIcons name="more-vert" size={24} color={Theme.Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          <View style={styles.moodRow}>
            {moods.map((m, index) => {
              const isSelected = mood === m.label;
              return (
                <Animated.View 
                  key={m.label}
                  style={{
                    transform: [
                      { scale: isSelected ? moodScales[index] : new Animated.Value(1) }
                    ]
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setMood(m.label);
                      animateMoodSelection(index);
                    }}
                    style={[
                      styles.moodButton,
                      isSelected && { 
                        backgroundColor: m.color,
                        shadowColor: m.color,
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.5,
                        shadowRadius: 5,
                        elevation: 6
                      }
                    ]}
                  >
                    <Animated.View
                      style={{
                        transform: [{ scale: isSelected ? moodAnimations[index] : new Animated.Value(1) }]
                      }}
                    >
                      <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    </Animated.View>
                    <Text style={[
                      styles.moodLabel,
                      isSelected && styles.selectedMoodLabel
                    ]}>
                      {m.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.moodIconContainer}>
                        <Feather name={m.icon} size={14} color="rgba(255,255,255,0.8)" />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
          
          {/* Hidden Mood History with Card Drop Interaction */}
          {moodHistory.length > 0 && (
            <TouchableOpacity 
              style={styles.moodHistoryCard}
              onPress={() => {
                setShowMoodHistory(!showMoodHistory);
                Animated.parallel([
                  Animated.timing(moodHistoryHeight, {
                    toValue: showMoodHistory ? 0 : 1,
                    duration: 300,
                    useNativeDriver: false,
                    easing: Easing.out(Easing.back(1.5))
                  }),
                  Animated.timing(moodHistoryOpacity, {
                    toValue: showMoodHistory ? 0 : 1,
                    duration: 300,
                    useNativeDriver: false
                  })
                ]).start();
              }}
            >
              <View style={[styles.moodHistoryCardHeader, { borderBottomWidth: showMoodHistory ? 1 : 0 }]}>
                <Text style={styles.moodHistoryCardTitle}>
                  {showMoodHistory ? 'Recent Moods' : 'View Mood History'}
                </Text>
                <Feather 
                  name={showMoodHistory ? 'chevron-up' : 'chevron-down'} 
                  size={18} 
                  color={Colors.primary} 
                />
              </View>
              
              <Animated.View 
                style={[styles.moodHistoryContent, {
                  height: showMoodHistory ? 'auto' : 0,
                  maxHeight: moodHistoryHeight.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 400] // Further increased height for more content
                  }),
                  opacity: moodHistoryOpacity
                }]}
              >
                {/* Mood Statistics Summary */}
                <View style={styles.moodHistoryStats}>
                  <View style={styles.moodStatItem}>
                    <Text style={styles.moodStatValue}>{moodHistory.length}</Text>
                    <Text style={styles.moodStatLabel}>Total Entries</Text>
                  </View>
                  <View style={styles.moodStatItem}>
                    <Text style={styles.moodStatValue}>
                      {moodHistory.length > 0 
                        ? moods.find(m => m.label === moodHistory[0].mood)?.emoji || '😐'
                        : '😐'}
                    </Text>
                    <Text style={styles.moodStatLabel}>Most Recent</Text>
                  </View>
                  <View style={styles.moodStatItem}>
                    <Text style={styles.moodStatValue}>1</Text>
                    <Text style={styles.moodStatLabel}>Day Streak</Text>
                    <View style={styles.moodTrendIndicator}>
                      <MaterialIcons 
                        name={'trending-up'} 
                        size={12} 
                        color={Colors.success} 
                      />
                      <Text style={[styles.moodTrendText, styles.moodTrendUp]}>
                        +1
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Group moods by month for better organization */}
                {groupMoodsByMonth().map((monthGroup, monthIndex) => (
                  <View key={`month-${monthIndex}`} style={styles.moodMonthContainer}>
                    <Text style={styles.moodMonthTitle}>{monthGroup.month}</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.moodScrollContent}
                    >
                      <View style={styles.moodTimeline}>
                        {monthGroup.moods.map((moodData, index) => {
                          const moodInfo = moods.find(m => m.label === moodData.mood);
                          return (
                            <TouchableOpacity 
                              key={`mood-${index}`} 
                              style={[styles.moodTimelineItem, { backgroundColor: `${moodInfo?.color}15` }]}
                              onPress={() => {
                                // Show a tooltip or alert with the full journal entry for this date
                                const entryDate = moment(moodData.date).format('MMMM D, YYYY');
                                Alert.alert(
                                  `${entryDate} - ${moodInfo?.label || 'Unknown'}`,
                                  `Tap to view your full journal entry for this date.`,
                                  [
                                    { text: 'View Entry', onPress: () => loadSpecificDate(moodData.date) },
                                    { text: 'Close', style: 'cancel' }
                                  ]
                                );
                              }}
                            >
                              <Text style={styles.moodEmoji}>{moodInfo?.emoji || '😐'}</Text>
                              <Text style={styles.moodTimelineDate}>
                                {moment(moodData.date).format('D')}
                              </Text>
                              <Text style={styles.moodTimelineDay}>
                                {moment(moodData.date).format('ddd')}
                              </Text>
                              <View style={[styles.moodDot, { backgroundColor: moodInfo?.color }]} />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </View>
                ))}
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.thoughtSection}>
          <Text style={styles.sectionTitle}>Thought of the Day</Text>
          <TextInput
            style={styles.thoughtInput}
            placeholder="or Your Quote of the Day?"
            value={thought}
            onChangeText={setThought}
            placeholderTextColor={Colors.muted}
          />
        </View>

        <View style={styles.entrySection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Journal Entry</Text>
          </View>
          <View style={styles.entryInputContainer}>
            <TextInput
              style={styles.entryInput}
              placeholder="How was your day -smiles,struggles or little wins? Tap to write it down !"
              value={entry}
              onChangeText={setEntry}
              multiline
              placeholderTextColor={Colors.muted}
            />
            {entry.length > 0 && (
              <View style={styles.entryLengthIndicator}>
                <Text style={styles.entryLengthText}>{entry.length} characters</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Voice Reflection section removed as requested */}

        <TouchableOpacity 
          style={[GlobalStyles.button, { 
            backgroundColor: selectedMoodColor,
            marginHorizontal: Spacing.medium,
            marginBottom: Spacing.large
          }]} 
          onPress={() => setShowConfirmModal(true)}
        >
          <Text style={GlobalStyles.buttonText}>Reflect & Save</Text>
        </TouchableOpacity>
        
        {/* Voice Input Modal (placeholder) */}
        <Modal
          visible={showVoiceInput}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVoiceInput(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.voiceInputModal}>
              <Text style={styles.voiceInputTitle}>Voice Input</Text>
              <View style={styles.voiceInputIconContainer}>
                <TouchableOpacity style={styles.voiceRecordButton}>
                  <Feather name="mic" size={40} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.voiceInputHint}>Tap to start recording</Text>
              </View>
              <View style={styles.voiceInputButtonRow}>
                <TouchableOpacity 
                  style={styles.voiceInputCancelButton}
                  onPress={() => setShowVoiceInput(false)}
                >
                  <Text style={styles.voiceInputButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.voiceInputSaveButton}>
                  <Text style={[styles.voiceInputButtonText, { color: Colors.textLight }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmModal}>
              <View style={styles.confirmModalHeader}>
                <Text style={styles.confirmModalTitle}>Save Your Reflection</Text>
              </View>
              <Text style={styles.confirmModalText}>
                Taking time to journal is a powerful way to process your day.
                Would you like to save this entry?
              </Text>
              <View style={styles.confirmButtonRow}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowConfirmModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: selectedMoodColor }]}
                  onPress={() => {
                    setShowConfirmModal(false);
                    saveEntry();
                  }}
                >
                  <Text style={styles.saveButtonText}>Save Entry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.historySection} ref={pastEntriesSectionRef}>
          <Text style={styles.sectionTitle}>Past Entries</Text>
          {history.map((h, idx) => {
            const moodInfo = moods.find(m => m.label === h.mood);
            return (
              <View key={idx} style={[GlobalStyles.card, styles.historyCard, selectedEntryRef === h.date ? styles.selectedHistoryCard : {}]}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyDateContainer}>
                    <Text style={styles.historyDate}>
                      {moment(h.date).format('MMM D, YYYY')}
                    </Text>
                    {h.isEdited && (
                      <View style={styles.editedBadge}>
                        <Text style={styles.editedText}>Edited</Text>
                        {h.editTimestamp && (
                          <Text style={styles.editTimestamp}>
                            {moment(h.editTimestamp.toDate()).format('MMM D, HH:mm')}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  {moodInfo && (
                    <View style={styles.historyMoodContainer}>
                      <View style={[
                        styles.historyMoodBadge,
                        { backgroundColor: `${moodInfo.color}20` }
                      ]}>
                        <Text style={[styles.historyMoodText, { color: moodInfo.color }]}>{moodInfo.emoji}</Text>
                        <Text style={[styles.historyMoodLabel, { color: moodInfo.color }]}>{h.mood}</Text>
                      </View>
                    </View>
                  )}
                </View>
                
                {h.thought && (
                  <View style={styles.historyThoughtContainer}>
                    <Text style={styles.historyThoughtLabel}>Thought</Text>
                    <Text style={styles.historyThought}>"{h.thought}"</Text>
                  </View>
                )}
                
                {h.entry && (
                  <View style={styles.historyEntryContainer}>
                    <Text style={styles.historyEntryLabel}>Entry</Text>
                    <Text style={styles.historyEntry} numberOfLines={expandedEntries[h.date] ? undefined : 3}>
                      {h.entry}
                    </Text>
                    <View style={styles.entryActionButtons}>
                      <TouchableOpacity 
                        style={styles.readMoreButton}
                        onPress={() => {
                          setExpandedEntries(prev => ({
                            ...prev,
                            [h.date]: !prev[h.date]
                          }));
                        }}
                      >
                        <Text style={styles.readMoreText}>
                          {expandedEntries[h.date] ? 'Show less' : 'Read more'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.readMoreButton}
                        onPress={() => openEditModal(h.date)}
                      >
                        <Text style={styles.readMoreText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                
                {moodInfo && (
                  <View style={[styles.moodIconOverlay, { backgroundColor: moodInfo.color }]}>
                    <Feather name={moodInfo.icon} size={14} color="#fff" />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={styles.optionsMenu}>
            <JournalExportButton asMenuItem={true} />
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowOptionsMenu(false);
              // Add other menu options here as needed
            }}>
              <MaterialIcons name="help-outline" size={24} color={Theme.Colors.text} />
              <Text style={styles.menuItemText}>Journal Tips</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Journal Entry Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>
                Edit Journal Entry - {moment(editDate).format('MMM D, YYYY')}
              </Text>
              <TouchableOpacity 
                onPress={() => setShowEditModal(false)}
                style={styles.closeButton}
              >
                <Feather name="x" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.editModalContent}>
              <Text style={styles.editModalLabel}>Mood</Text>
              <View style={styles.editMoodDisplay}>
                <Text style={styles.editMoodEmoji}>
                  {moods.find(m => m.label === editMood)?.emoji || '😐'}
                </Text>
                <Text style={styles.editMoodLabel}>
                  {editMood || 'Neutral'}
                </Text>
                <Text style={styles.editMoodLocked}>(Mood cannot be changed)</Text>
              </View>
              
              <Text style={styles.editModalLabel}>Thought of the Day</Text>
              <TextInput
                style={styles.editThoughtInput}
                value={editThought}
                onChangeText={setEditThought}
                placeholder="Enter your thought"
                multiline
              />
              
              <Text style={styles.editModalLabel}>Journal Entry</Text>
              <TextInput
                style={styles.editEntryInput}
                value={editEntry}
                onChangeText={setEditEntry}
                placeholder="Write your journal entry"
                multiline
              />
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.saveEditButton, { backgroundColor: moods.find(m => m.label === editMood)?.color || Colors.primary }]}
              onPress={saveEditedEntry}
            >
              <Text style={styles.saveEditButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Journal;

const styles = StyleSheet.create({  
  optionsMenu: {
    position: 'absolute',
    top: 60,
    right: 10,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.medium,
  },
  menuItemText: {
    ...Typography.body,
    marginLeft: Spacing.small,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: Spacing.medium,
    paddingBottom: Spacing.medium,
    backgroundColor: Colors.surface,
  },
  menuButton: {
    padding: Spacing.small,
  },
  title: {
    ...Typography.heading,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: Spacing.medium,
  },
  sectionTitle: {
    ...Typography.subheading,
    marginBottom: Spacing.medium,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.small,
  },
  moodSection: {
    marginBottom: Spacing.large,
    paddingHorizontal: Spacing.medium,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: Spacing.small,
  },
  moodButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: Spacing.small,
    alignItems: 'center',
    width: 60,
    height: 90,
    justifyContent: 'center',
    marginHorizontal: 3,
    marginBottom: Spacing.small,
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: Spacing.small,
  },
  moodLabel: {
    ...Typography.caption,
    textAlign: 'center',
    fontSize: 8,
  },
  selectedMoodLabel: {
    color: Colors.textLight,
  },
  selectedHistoryCard: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  entryActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.small,
    gap: Spacing.medium,
  },
  // Removed editButton and editButtonText styles as we're now using readMoreButton and readMoreText
  moodIconContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodHistoryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    marginTop: Spacing.medium,
    marginBottom: Spacing.small,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: `${Colors.border}30`,
  },
  moodHistoryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.border}50`,
  },
  moodHistoryCardTitle: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  moodHistoryContent: {
    overflow: 'hidden',
    paddingBottom: Spacing.small,
  },
  moodHistoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.medium,
    paddingBottom: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  moodStatItem: {
    alignItems: 'center',
  },
  moodStatValue: {
    ...Typography.heading,
    fontSize: 18,
    fontWeight: 'bold',
  },
  moodStatLabel: {
    ...Typography.caption,
    color: Colors.muted,
  },
  moodTrendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.tiny,
  },
  moodTrendText: {
    ...Typography.caption,
    fontSize: 10,
    marginLeft: 2,
  },
  moodTrendUp: {
    color: Colors.success,
  },
  moodTrendDown: {
    color: Colors.error,
  },
  moodMonthContainer: {
    marginBottom: Spacing.medium,
  },
  moodMonthTitle: {
    ...Typography.subtitle,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: Spacing.medium,
    marginBottom: Spacing.small,
    color: Colors.text,
  },
  moodScrollContent: {
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.medium,
  },
  moodScrollContent: {
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.small,
    alignItems: 'center',
  },
  moodTimeline: {
    flexDirection: 'row',
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.medium,
  },
  moodTimelineItem: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.small,
    marginHorizontal: Spacing.small,
    width: 60,
    height: 90,
    backgroundColor: 'transparent',
  },
  moodTimelineDate: {
    ...Typography.caption,
    marginTop: Spacing.tiny,
    fontWeight: '600',
    fontSize: 14,
  },
  moodTimelineDay: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.muted,
  },
  moodDot: {
    position: 'absolute',
    bottom: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  audioReflectionSection: {
    marginBottom: Spacing.large,
    paddingHorizontal: Spacing.medium,
  },
  audioReflectionTitle: {
    ...Typography.subheading,
    marginBottom: Spacing.small,
  },
  audioReflectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.medium,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  audioRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.medium,
  },
  audioRecordIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.medium,
  },
  audioRecordingIcon: {
    backgroundColor: 'rgba(255,0,0,0.1)',
  },
  audioRecordText: {
    ...Typography.body,
    color: Colors.text,
  },
  audioPlaybackContainer: {
    padding: Spacing.small,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    marginBottom: Spacing.medium,
  },
  audioWaveformBar: {
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDuration: {
    ...Typography.body,
    color: Colors.text,
  },
  audioDeleteButton: {
    padding: Spacing.small,
  },
  thoughtSection: {
    marginBottom: Spacing.large,
    paddingHorizontal: Spacing.medium,
  },
  thoughtInput: {
    ...GlobalStyles.input,
    minHeight: 50,
  },
  entrySection: {
    marginBottom: Spacing.large,
    paddingHorizontal: Spacing.medium,
  },
  entryInputContainer: {
    position: 'relative',
  },
  entryInput: {
    ...GlobalStyles.input,
    minHeight: 150,
    textAlignVertical: 'top',
    paddingBottom: 30, // Space for the character count
  },
  entryLengthIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  entryLengthText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.muted,
  },
  voiceInputButton: {
    padding: Spacing.small,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
  },
  historySection: {
    marginTop: Spacing.large,
    paddingHorizontal: Spacing.medium,
  },
  historyCard: {
    marginBottom: Spacing.medium,
    padding: Spacing.medium,
    position: 'relative',
    overflow: 'hidden',
  },
  editModal: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: Spacing.medium,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.medium,
    paddingBottom: Spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editModalTitle: {
    ...Typography.heading,
    fontSize: 18,
  },
  closeButton: {
    padding: Spacing.tiny,
  },
  editModalContent: {
    marginBottom: Spacing.medium,
  },
  editModalLabel: {
    ...Typography.subheading,
    marginTop: Spacing.medium,
    marginBottom: Spacing.small,
  },
  editMoodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.medium,
    borderRadius: 8,
  },
  editMoodEmoji: {
    fontSize: 24,
    marginRight: Spacing.small,
  },
  editMoodLabel: {
    ...Typography.body,
    fontWeight: '600',
    marginRight: Spacing.small,
  },
  editMoodLocked: {
    ...Typography.caption,
    color: Colors.muted,
    fontStyle: 'italic',
  },
  editThoughtInput: {
    ...Typography.body,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.medium,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editEntryInput: {
    ...Typography.body,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing.medium,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  saveEditButton: {
    borderRadius: 8,
    paddingVertical: Spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.medium,
  },
  saveEditButtonText: {
    ...Typography.button,
    color: Colors.textLight,
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.medium,
  },
  historyDateContainer: {
    flexDirection: 'column',
  },
  editedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  editedText: {
    ...Typography.caption,
    color: Colors.primary,
    fontStyle: 'italic',
    fontSize: 10,
    marginRight: 4,
  },
  editTimestamp: {
    ...Typography.caption,
    color: Colors.muted,
    fontSize: 10,
  },
  historyDate: {
    ...Typography.subheading,
  },
  historyMoodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyMoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.small,
    paddingVertical: Spacing.tiny,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  historyMoodText: {
    fontSize: 16,
    marginRight: 4,
  },
  historyMoodLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  historyThoughtContainer: {
    marginBottom: Spacing.medium,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: Spacing.small,
    borderRadius: 8,
  },
  historyThoughtLabel: {
    ...Typography.caption,
    color: Colors.muted,
    marginBottom: 4,
    fontWeight: '600',
  },
  historyThought: {
    ...Typography.body,
    fontStyle: 'italic',
  },
  historyEntryContainer: {
    marginBottom: Spacing.small,
  },
  historyEntryLabel: {
    ...Typography.caption,
    color: Colors.muted,
    marginBottom: 4,
    fontWeight: '600',
  },
  historyEntry: {
    ...Typography.body,
    color: Colors.text,
  },
  readMoreButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.small,
  },
  readMoreText: {
    ...Typography.caption,
    color: Colors.primary,
  },
  moodIconOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomLeftRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.medium,
    width: '80%',
    maxWidth: 400,
  },
  confirmModalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.small,
    marginBottom: Spacing.medium,
  },
  confirmModalTitle: {
    ...Typography.subheading,
    textAlign: 'center',
  },
  confirmModalText: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.medium,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: 8,
    marginRight: Spacing.small,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.text,
  },
  saveButton: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.textLight,
  },
  voiceInputModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.medium,
    width: '80%',
    maxWidth: 400,
  },
  voiceInputTitle: {
    ...Typography.subheading,
    textAlign: 'center',
    marginBottom: Spacing.medium,
  },
  voiceInputIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.large,
  },
  voiceRecordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.medium,
  },
  voiceInputHint: {
    ...Typography.caption,
    color: Colors.muted,
  },
  voiceInputButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voiceInputCancelButton: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: 8,
    marginRight: Spacing.small,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  voiceInputButtonText: {
    ...Typography.body,
  },
  voiceInputSaveButton: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  exportButtonContainer: {
    marginVertical: 10,
    paddingHorizontal: 16,
  },
});


