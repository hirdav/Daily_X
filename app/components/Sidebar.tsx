import React, { useEffect, useState, useRef } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import OfflineStatusIcon from './OfflineStatusIcon';
import ProfilePictureSelector from './ProfilePictureSelector';
import { Colors, Typography, Spacing, GlobalStyles, Layout } from '../styles/global';
import LevelUpAnimation from './LevelUpAnimation';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import { getTotalXPFromBank, getTodayXPFromBank } from '../utils/firebaseService';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

type MenuItem = {
  name: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label?: string;
  badge?: number;
};

interface UserStats {
  totalXP: number;
  todayXP: number;
  level: number;
  levelProgress: number;
  nextLevelXP: number;
  weightedPoints: number;
}

interface UserProfile {
  username: string;
  displayName: string;
  profilePictureId: string | null;
}

type LevelInfo = { 
  level: number;
  progress: number; // value between 0 and 1
  currentLevelXP: number;
  nextLevelXP: number;
};

// Weighted blend level calculation (60% XP, 40% task count)
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

const menuItems: MenuItem[] = [
  { name: 'Dashboard', icon: 'dashboard' },
  { name: 'ManageTasks', icon: 'list', label: 'Tasks' },
  { name: 'Journal', icon: 'book' },
  { name: 'History', icon: 'history' },
  // Analytics removed as requested
  { name: 'Profile', icon: 'person' },
  { name: 'Settings', icon: 'settings' },
];

// Legacy level calculation - replaced by getLevelInfo
const calculateLevel = (xp: number): number => {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

const Sidebar: React.FC<DrawerContentComponentProps> = ({ navigation, state }) => {
  const [showLevelUp, setShowLevelUp] = useState(false);
  const prevLevel = useRef(1);
  // Local states to always have the latest values
  const [localTotalXP, setLocalTotalXP] = useState(0);
  const [localCompletedTasks, setLocalCompletedTasks] = useState(0);

  const { stats: contextStats } = require('../contexts/StatsContext').useStats ? require('../contexts/StatsContext').useStats() : { stats: null };
const [stats, setStats] = useState<UserStats>({
  totalXP: 0,
  todayXP: 0,
  level: 1,
  levelProgress: 0,
  nextLevelXP: 10,
});

// XP loading state
const [xpLoading, setXPLoading] = useState(false);
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    username: '',
    displayName: '',
    profilePictureId: null,
  });

  const user = FIREBASE_AUTH.currentUser;
  const isSmallScreen = Dimensions.get('window').width < 768;

  useEffect(() => {
    if (!user) return;
    // Local states for XP/tasks
    setLocalTotalXP(0);
    setLocalCompletedTasks(0);
    // Load user profile information (one-time fetch)
    const loadUserProfile = async () => {
      try {
        const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile({
            username: userData.username || user.displayName || 'User',
            displayName: userData.displayName || user.displayName || 'User',
            profilePictureId: userData.profilePictureId || null,
          });
        } else {
          setUserProfile({
            username: user.displayName || 'User',
            displayName: user.displayName || 'User',
            profilePictureId: null,
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };
    loadUserProfile();
    setXPLoading(true);
    // Real-time XP and task stats
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
      // Fetch today's XP
      const todayXP = await getTodayXPFromBank();
      setLocalTotalXP(totalXP);
      setStats(prev => {
          // Use the latest completedTasks from localCompletedTasks
          const levelInfo = getLevelInfo(totalXP, localCompletedTasks);
          // Level-up animation trigger
          if (levelInfo.level > prev.level) {
            setShowLevelUp(true);
          }
          prevLevel.current = levelInfo.level;
          return {
            ...prev,
            totalXP,
            todayXP,
            level: levelInfo.level,
            levelProgress: levelInfo.progress,
            nextLevelXP: levelInfo.nextLevelXP,
            weightedPoints: Math.round((totalXP * 0.6 + localCompletedTasks * 40)),
          };
        });
      setXPLoading(false);
    });

    // Listen to tasks changes for completedTasks and level
    const unsubscribeTasks = onSnapshot(tasksRef, (tasksSnapshot) => {
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
      await FIREBASE_AUTH.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) return null;

  return (
    <View style={[styles.container, isSmallScreen && styles.smallScreen]}>
      <LevelUpAnimation
        visible={showLevelUp}
        level={stats.level}
        onAnimationEnd={() => setShowLevelUp(false)}
      />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.title}>DailyX</Text>
          <OfflineStatusIcon />
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Level {stats.level}</Text>
        </View>
      </View>
      
      {/* User Profile Section - Profile picture is read-only in sidebar */}
      <View style={styles.userProfileSection}>
        <ProfilePictureSelector size={60} showEditButton={false} readOnly={true} />
        <Text style={styles.username}>{userProfile.username}</Text>
      </View>

      <View style={styles.xpSection}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>Total XP</Text>
          <Text style={styles.xpValue}>{xpLoading ? '...' : stats.totalXP}</Text>
        </View>
        {stats.todayXP > 0 && !xpLoading && (
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>Today's XP</Text>
            <View style={GlobalStyles.xpBadge}>
              <Text style={GlobalStyles.xpText}>+{stats.todayXP}</Text>
            </View>
          </View>
        )}
        
        {/* Level Progress Bar */}
        <View style={styles.levelProgressContainer}>
          <View style={styles.levelProgressHeader}>
            <Text style={styles.levelProgressLabel}>Level {stats.level}</Text>
            <Text style={styles.levelProgressText}>
              {Math.floor(stats.levelProgress * 100)}% to Level {stats.level + 1}
            </Text>
          </View>
          <View style={styles.levelProgressBarContainer}>
            <View 
              style={[styles.levelProgressBar, { width: `${stats.levelProgress * 100}%` }]} 
            />
          </View>
          <View style={styles.levelXPInfo}>
            <Text style={styles.levelXPText}>
              Points: {stats.weightedPoints || 0} / {stats.nextLevelXP || 10}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.menuItem,
              state.routeNames[state.index] === item.name && styles.menuItemActive,
            ]}
            onPress={() => {
              navigation.navigate(item.name);
              if (isSmallScreen) {
                navigation.closeDrawer();
              }
            }}
          >
            <MaterialIcons 
              name={item.icon} 
              size={20} 
              color={state.routeNames[state.index] === item.name ? Colors.primary : Colors.text} 
            />
            <Text style={[
              styles.menuText,
              state.routeNames[state.index] === item.name && styles.menuTextActive,
            ]}>
              {item.label || item.name}
            </Text>
            {item.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <MaterialIcons name="logout" size={20} color={Colors.text} />
        <Text style={styles.menuText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: Layout.sidebarWidth,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  smallScreen: {
    width: '100%',
  },
  header: {
    paddingTop: 50,
    paddingBottom: Spacing.medium,
    paddingHorizontal: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...Typography.heading,
    color: Colors.primary,
  },
  levelBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.small,
    paddingVertical: Spacing.tiny,
    borderRadius: 12,
  },
  levelText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  xpSection: {
    padding: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  userProfileSection: {
    padding: Spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    ...Typography.body,
    fontWeight: '600',
    marginLeft: Spacing.medium,
    color: Colors.text,
    flex: 1,
  },
  levelProgressContainer: {
    marginTop: Spacing.small,
  },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.tiny,
  },
  levelProgressLabel: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.primary,
  },
  levelProgressText: {
    ...Typography.caption,
    color: Colors.muted,
    fontSize: 10,
  },
  levelProgressBarContainer: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelProgressBar: {
    height: 6,
    backgroundColor: Colors.primary,
  },
  levelXPInfo: {
    alignItems: 'center',
    marginTop: Spacing.tiny,
  },
  levelXPText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.muted,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.small,
  },
  xpLabel: {
    ...Typography.sidebarText,
    color: Colors.muted,
  },
  xpValue: {
    ...Typography.sidebarText,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingTop: Spacing.medium,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.medium,
    marginHorizontal: Spacing.small,
    marginBottom: Spacing.small,
    borderRadius: 8,
  },
  menuItemActive: {
    backgroundColor: Colors.primary + '10',
  },
  menuText: {
    ...Typography.sidebarText,
    marginLeft: Spacing.medium,
    flex: 1,
  },
  menuTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.medium,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});

export default Sidebar;
