import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import ProfilePictureSelector from '../components/ProfilePictureSelector';
import { FIREBASE_AUTH, FIREBASE_DB, FIREBASE_STORAGE } from '../../FirebaseConfig';
import { clearPersistedAuth } from '../utils/authPersistence';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';
import { updateDoc } from 'firebase/firestore';
import { doc } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { getTotalXPFromBank, getTodayXPFromBank } from '../utils/firebaseService';
import { Colors, Typography, Spacing } from '../styles/global';
import LevelUpAnimation from '../components/LevelUpAnimation';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Level calculation function with weighted blend (60% XP, 40% task count)
type LevelInfo = { 
  level: number;
  progress: number; // value between 0 and 1
  currentLevelXP: number;
  nextLevelXP: number;
};

const getLevelInfo = (totalPoints: number, taskCount: number = 0): LevelInfo => {
  // Calculate the weighted score using 60% XP and 40% task count
  const weightedScore = (totalPoints * 0.6 + taskCount * 40) / 10;
  const level = Math.floor(Math.sqrt(weightedScore));
  
  // Calculate the current and next level thresholds based on the weighted formula
  const currentLevelThreshold = (level ** 2) * 10;
  const nextLevelThreshold = ((level + 1) ** 2) * 10;
  
  // Calculate progress to next level
  const progress = (weightedScore * 10 - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold);

  return {
    level,
    progress: Math.min(Math.max(progress, 0), 1), // clamp between 0 and 1
    currentLevelXP: Math.round(currentLevelThreshold),
    nextLevelXP: Math.round(nextLevelThreshold),
  };
};

type RootStackParamList = {
  Home: undefined;
  Profile: undefined;
};

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Stats {
  totalTasks: number;
  completedTasks: number;
  totalXP: number;
  streakCount: number;
  averageXPPerDay: number;
  level: number;
  levelProgress: number;
  nextLevelXP: number;
  weightedPoints: number;
}

const Profile = () => {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const prevLevel = useRef(1);
  // Local states to always have the latest values
  const [localTotalXP, setLocalTotalXP] = useState(0);
  const [localCompletedTasks, setLocalCompletedTasks] = useState(0);
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const user = FIREBASE_AUTH.currentUser;
  const { stats: contextStats } = require('../contexts/StatsContext').useStats ? require('../contexts/StatsContext').useStats() : { stats: null };
const [stats, setStats] = useState<Stats>({
  totalTasks: 0,
  completedTasks: 0,
  totalXP: 0,
  streakCount: 0,
  averageXPPerDay: 0,
  level: 1,
  levelProgress: 0,
  nextLevelXP: 10,
});

// XP loading state
const [xpLoading, setXPLoading] = useState(false);
  
  // User profile data
  const [fullName, setFullName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  
  // Force refresh counter
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Function to fetch user profile data
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(FIREBASE_DB, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.fullName) {
          setFullName(userData.fullName);
        }
        if (userData.username) {
          setUsername(userData.username);
        }
        // Note: Profile picture is handled by the ProfilePictureSelector component
        // which reads from the same Firestore document
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };
  
  useEffect(() => {
    if (!user) return;
    fetchUserProfile();
    setXPLoading(true);
    // Subscribe to real-time updates from xpBank and tasks
    const xpBankRef = collection(FIREBASE_DB, 'users', user.uid, 'xpBank');
    const tasksRef = collection(FIREBASE_DB, 'users', user.uid, 'tasks');

    // Listen to XP bank changes
    const unsubscribeXP = onSnapshot(xpBankRef, async (snapshot) => {
      let totalXP = 0;
      let daysWithXP = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (typeof data.totalXP === 'number') {
          totalXP += data.totalXP;
          daysWithXP++;
        }
      });
      const averageXPPerDay = daysWithXP > 0 ? parseFloat((totalXP / daysWithXP).toFixed(2)) : 0;
      // Fetch today's XP
      const todayXP = await getTodayXPFromBank();
      // We'll update completedTasks below
      setLocalTotalXP(totalXP);
      setStats(prev => {
        // Use latest completedTasks from localCompletedTasks
        const levelInfo = getLevelInfo(totalXP, localCompletedTasks);
        // Level-up animation trigger
        if (levelInfo.level > prev.level) {
          setShowLevelUp(true);
        }
        prevLevel.current = levelInfo.level;
        return {
          ...prev,
          totalXP,
          averageXPPerDay,
          level: levelInfo.level,
          levelProgress: levelInfo.progress,
          nextLevelXP: levelInfo.nextLevelXP,
          weightedPoints: Math.round((totalXP * 0.6 + localCompletedTasks * 40)),
        };
      });
      setXPLoading(false);
    });

    // Listen to tasks changes for total/completed tasks and level
    const unsubscribeTasks = onSnapshot(tasksRef, (tasksSnapshot) => {
      const totalTasks = tasksSnapshot.size;
      let completedTasks = 0;
      tasksSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed') completedTasks++;
      });
      setLocalCompletedTasks(completedTasks);
      setStats(prev => {
        // Use latest totalXP from localTotalXP
        const levelInfo = getLevelInfo(localTotalXP, completedTasks);
        // Level-up animation trigger
        if (levelInfo.level > prev.level) {
          setShowLevelUp(true);
        }
        prevLevel.current = levelInfo.level;
        return {
          ...prev,
          totalTasks,
          completedTasks,
          level: levelInfo.level,
          levelProgress: levelInfo.progress,
          nextLevelXP: levelInfo.nextLevelXP,
          weightedPoints: Math.round((localTotalXP * 0.6 + completedTasks * 40)),
        };
      });
    });

    return () => {
      unsubscribeXP();
      unsubscribeTasks();
    };
  }, [user]);

  const handleSignOut = async () => {
    try {
      // Clear persisted auth data first
      await clearPersistedAuth();
      // Then sign out from Firebase
      await FIREBASE_AUTH.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LevelUpAnimation
        visible={showLevelUp}
        level={stats.level}
        onAnimationEnd={() => setShowLevelUp(false)}
      />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <MaterialIcons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.refreshButton} onPress={() => {
            setRefreshCounter(prev => prev + 1);
            fetchUserStats();
          }}>
            <MaterialIcons name="refresh" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <MaterialIcons name="logout" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.userInfo}>
          <View style={styles.profilePictureContainer}>
            <ProfilePictureSelector size={100} />
          </View>
          
          <View style={styles.nameContainer}>
            <Text style={styles.userName}>{fullName || 'No name set'}</Text>
            
          </View>
          
          <View style={styles.usernameContainer}>
            <Text style={styles.usernameLabel}>Username:</Text>
            <Text style={styles.usernameText}>@{username || 'unknown'}</Text>
          </View>
          
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.joinDate}>
            Joined {new Date(user.metadata.creationTime || Date.now()).toLocaleDateString()}
          </Text>
          
          {/* Level Badge */}
          <View style={styles.levelBadgeContainer}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNumber}>{stats.level || 1}</Text>
            </View>
            <Text style={styles.levelLabel}>LEVEL {stats.level || 1}</Text>
          </View>
          
          {/* Level Progress Bar */}
          <View style={styles.levelProgressContainer}>
            <View style={styles.levelProgressBarContainer}>
              <View 
                style={[styles.levelProgressBar, { width: `${(stats.levelProgress || 0) * 100}%` }]} 
              />
            </View>
            <View style={styles.levelProgressInfo}>
              <Text style={styles.levelProgressText}>
                {Math.floor((stats.levelProgress || 0) * 100)}% to Level {(stats.level || 1) + 1}
              </Text>
              <Text style={styles.levelXPText}>
                Points: {stats.weightedPoints || 0} / {stats.nextLevelXP || 10}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="star" size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{xpLoading ? '...' : stats.totalXP}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialIcons name="assignment" size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.totalTasks}</Text>
            <Text style={styles.statLabel}>Achieved Tasks</Text>
          </View>


          <View style={styles.statCard}>
            <MaterialIcons name="trending-up" size={24} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.averageXPPerDay}</Text>
            <Text style={styles.statLabel}>XP/Day</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.medium,
    paddingVertical: Spacing.small,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuButton: {
    padding: Spacing.small,
  },
  title: {   // change the header title size
    flex: 1,
    fontSize: 22,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
    alignSelf: 'center',
    paddingVertical: 2,
    marginLeft: 50, // Slight right shift for better alignment
  },
  headerButtons: {
    flexDirection: 'row',
  },
  refreshButton: {
    padding: Spacing.small,
    marginRight: Spacing.small,
  },
  signOutButton: {
    padding: Spacing.small,
  },
  content: {
    flex: 1,
    padding: Spacing.medium,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: Spacing.large,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    paddingVertical: Spacing.large,
    paddingHorizontal: Spacing.medium,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  profilePictureContainer: {
    marginBottom: Spacing.medium,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: Spacing.small,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.tiny,
  },
  nameEditInfo: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: Spacing.small,
    fontStyle: 'italic',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.medium,
  },
  usernameLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginRight: Spacing.small,
  },
  usernameText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
  email: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: Spacing.small,
  },
  joinDate: {
    ...Typography.caption,
    color: Colors.muted,
  },
  levelBadgeContainer: {
    alignItems: 'center',
    marginTop: Spacing.medium,
  },
  profilePictureContainerLarge: {
    marginBottom: Spacing.medium,
    alignItems: 'center',
  },
  levelBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.small,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: Colors.textLight,
  },
  levelNumber: {
    ...Typography.heading,
    color: Colors.textLight,
    fontSize: 24,
    fontWeight: 'bold',
  },
  levelLabel: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  levelProgressContainer: {
    width: '100%',
    marginTop: Spacing.medium,
  },
  levelProgressBarContainer: {
    height: 14,
    backgroundColor: Colors.border,
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: Spacing.tiny,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  levelProgressBar: {
    height: 14,
    backgroundColor: Colors.primary,
    borderRadius: 7,
  },
  levelProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelProgressText: {
    ...Typography.caption,
    color: Colors.text,
  },
  levelXPText: {
    ...Typography.caption,
    color: Colors.muted,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.medium,
    gap: Spacing.medium,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.large,
    paddingHorizontal: Spacing.medium,
    alignItems: 'center',
    marginBottom: Spacing.medium,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  statValue: {
    ...Typography.heading,
    marginVertical: Spacing.small,
    fontWeight: 'bold',
    fontSize: 22,
    color: Colors.primary,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.5,
    fontSize: 14,
  },
});

export default Profile;
