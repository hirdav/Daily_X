import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_AUTH } from '../../FirebaseConfig';
import { onAuthStateChanged, User, signInWithCustomToken, getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Keys for storing auth data
const AUTH_USER_KEY = 'dailyx_auth_user';
const AUTH_CREDENTIALS_KEY = 'dailyx_auth_credentials';

/**
 * Handles persisting and restoring the Firebase authentication state
 * to prevent frequent re-authentication requirements
 */
export const setupAuthPersistence = () => {
  // First try to restore auth session if needed
  restoreAuthSession();
  
  // Set up auth state listener for future changes
  onAuthStateChanged(FIREBASE_AUTH, async (user) => {
    if (user) {
      // User is signed in, save their auth data
      try {
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLoginAt: new Date().toISOString(),
        };
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        console.log('Auth state saved to AsyncStorage');
      } catch (error) {
        console.error('Error saving auth state:', error);
      }
    } else {
      // User is signed out, clear their auth data
      try {
        await AsyncStorage.removeItem(AUTH_USER_KEY);
        await AsyncStorage.removeItem(AUTH_CREDENTIALS_KEY);
        console.log('Auth state cleared from AsyncStorage');
      } catch (error) {
        console.error('Error clearing auth state:', error);
      }
    }
  });
};

/**
 * Saves login credentials (email/password) securely for auto-login
 * This should only be called when user explicitly checks "Remember me"
 */
export const saveAuthCredentials = async (email: string, password: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify({ email, password }));
    console.log('Auth credentials saved');
  } catch (error) {
    console.error('Error saving auth credentials:', error);
  }
};

/**
 * Attempts to restore the auth session from stored credentials
 * This is called on app startup to silently re-authenticate
 */
export const restoreAuthSession = async (): Promise<boolean> => {
  try {
    // Check if we're already logged in
    if (FIREBASE_AUTH.currentUser) {
      console.log('Already authenticated, no need to restore');
      return true;
    }
    
    // Try to get stored credentials
    const credentialsJson = await AsyncStorage.getItem(AUTH_CREDENTIALS_KEY);
    if (!credentialsJson) {
      console.log('No stored credentials found');
      return false;
    }
    
    const { email, password } = JSON.parse(credentialsJson);
    if (!email || !password) {
      console.log('Incomplete credentials found');
      return false;
    }
    
    // Attempt silent re-authentication
    console.log('Attempting to restore auth session...');
    await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
    console.log('Auth session restored successfully');
    return true;
  } catch (error) {
    console.error('Failed to restore auth session:', error);
    return false;
  }
};

/**
 * Checks if a user is already authenticated based on stored data
 * This can be used for quick UI decisions before Firebase fully initializes
 */
export const checkPersistedAuth = async (): Promise<boolean> => {
  try {
    const userData = await AsyncStorage.getItem(AUTH_USER_KEY);
    return userData !== null;
  } catch (error) {
    console.error('Error checking auth persistence:', error);
    return false;
  }
};

/**
 * Gets the current user data from persistent storage
 * This is faster than waiting for Firebase to initialize
 */
export const getPersistedUser = async (): Promise<any | null> => {
  try {
    const userData = await AsyncStorage.getItem(AUTH_USER_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting persisted user:', error);
    return null;
  }
};

/**
 * Clears the persisted authentication data
 * Call this when manually signing out
 */
export const clearPersistedAuth = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  } catch (error) {
    console.error('Error clearing persisted auth:', error);
  }
};
