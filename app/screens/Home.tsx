import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import GlitchText from '../components/GlitchText';
import { Colors, Spacing } from '../styles/global';
import { checkPersistedAuth } from '../utils/authPersistence';
import { FIREBASE_AUTH } from '../../FirebaseConfig';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

const Home = ({ navigation }: { navigation: NativeStackNavigationProp<RootStackParamList> }) => {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check for existing auth session immediately
    const checkAuth = async () => {
      try {
        // First check our persisted auth in AsyncStorage (fast)
        const hasPersistedAuth = await checkPersistedAuth();
        
        // If we have persisted auth, check if Firebase auth is also valid
        // This handles the case where token might be expired
        const currentUser = FIREBASE_AUTH.currentUser;
        
        // Wait a minimum time for splash screen effect
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (hasPersistedAuth && currentUser) {
          // User is already authenticated, go directly to main app
          navigation.replace('Main');
        } else {
          // No valid auth found, go to login
          navigation.replace('Login');
        }
      } catch (error) {
        // Logging removed for production ('Auth check failed:', error);
        // On error, default to login screen
        navigation.replace('Login');
      } finally {
        setChecking(false);
      }
    };
    
    checkAuth();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <GlitchText>D-a-i-l-y-X</GlitchText>
      {checking && (
        <ActivityIndicator 
          size="large" 
          color={Colors.primary} 
          style={styles.loader} 
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.medium,
  },
  loader: {
    marginTop: Spacing.medium,
    position: 'absolute',
    bottom: 100,
  },
});

export default Home;

