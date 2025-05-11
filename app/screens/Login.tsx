import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { useGoogleAuth } from '../services/googleAuthService';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Colors, Typography, Spacing } from '../styles/global'; // Removed Breakpoints import since it's causing issues
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import Checkbox from 'expo-checkbox';
import PasswordResetModal from '../components/PasswordResetModal';
import { saveAuthCredentials, checkPersistedAuth } from '../utils/authPersistence';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

const Login: React.FC<Props> = ({ navigation }) => {
  // Log the actual redirect URI used by expo-auth-session

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [isRemembered, setIsRemembered] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // Initialize Google Auth hook
  const { signInWithGoogle, request } = useGoogleAuth();

  // Check for existing authentication when the screen loads
  React.useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        // Check if user is already authenticated
        const currentUser = FIREBASE_AUTH.currentUser;
        if (currentUser) {
          console.log('User already authenticated, redirecting to Main');
          navigation.replace('Main');
          return;
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
      }
    };
    
    checkExistingAuth();
  }, [navigation]);

  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const createUserDocument = async (userId: string) => {
    try {
      const userRef = doc(FIREBASE_DB, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email,
          createdAt: new Date(),
          xp: 0,
          streakCount: 0,
          lastActive: new Date(),
        });
      }
    } catch (error) {
      console.error('Error creating user document:', error);
      Alert.alert('Error', 'Failed to initialize user data');
    }
  };

  const validateInputs = () => {
    let isValid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      setEmailError('');
    }
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }
    return isValid;
  };

  const handleSignIn = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      // Attempt to sign in with Firebase
      const response = await signInWithEmailAndPassword(FIREBASE_AUTH, email, password);
      
      // If "Remember me" is checked, save credentials for future auto-login
      if (isRemembered) {
        await saveAuthCredentials(email, password);
      }
      
      // Ensure user document exists
      await createUserDocument(response.user.uid);
      
      // Navigate to main app
      navigation.replace('Main'); // Using replace instead of navigate to prevent going back to login
    } catch (error: any) {
      // Only log errors that are not authentication-related
      if (!error.code || !error.code.startsWith('auth/')) {
        console.error('Sign in error:', error);
      }
      
      // Provide user-friendly error messages based on Firebase error codes
      let errorMessage = 'An error occurred during sign in';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            errorMessage = 'The email or password you entered is incorrect. Please try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. Please contact support.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many unsuccessful login attempts. Please try again later or reset your password.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          default:
            errorMessage = `Sign in failed: ${error.message}`;
        }
      }
      
      Alert.alert('Sign In Error', errorMessage);
    } finally {
      setLoading(false); // Ensure loading is reset
    }
  };

  // Navigate to the SignUp screen instead of creating account directly
  const handleNavigateToSignUp = () => {
    navigation.navigate('SignUp');
  };

  const handleForgotPassword = () => {
    setIsResetModalVisible(true);
  };

  // Google Sign-In handler
  const [showUpcomingFeature, setShowUpcomingFeature] = useState(false);
  const handleGoogleSignIn = () => {
    setShowUpcomingFeature(true);
  };



  // Removed Breakpoints dependency, using a hardcoded value for now
  const isSmallScreen = dimensions.width < 768;

  return (
    <View style={styles.container}>
      {/* Upcoming Feature Banner/Modal */}
      {showUpcomingFeature && (
        <View style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          backgroundColor: '#fffbe6',
          borderColor: '#ffe58f',
          borderWidth: 1,
          borderRadius: 8,
          margin: 24,
          padding: 20,
          alignItems: 'center',
          zIndex: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ad8b00', marginBottom: 8 }}>
            Upcoming Feature
          </Text>
          <Text style={{ color: '#ad8b00', marginBottom: 16, textAlign: 'center' }}>
            Google Sign-In is coming soon! Stay tuned for updates.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#ffe58f', paddingVertical: 8, paddingHorizontal: 24, borderRadius: 6 }}
            onPress={() => setShowUpcomingFeature(false)}
          >
            <Text style={{ color: '#ad8b00', fontWeight: 'bold' }}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      <PasswordResetModal 
        visible={isResetModalVisible} 
        onClose={() => setIsResetModalVisible(false)} 
      />
      
      <View style={[styles.content, !isSmallScreen && styles.contentWide]}>
        <View style={styles.header}>
          <Text style={styles.title}>DailyX</Text>
          <Text style={styles.subtitle}>Track your daily progress</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            placeholder="Email"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor={Colors.muted}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <TextInput
            style={[styles.input, passwordError ? styles.inputError : null]}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholderTextColor={Colors.muted}
          />
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          <View style={styles.rememberContainer}>
            <Checkbox
              value={isRemembered}
              onValueChange={setIsRemembered}
              color={isRemembered ? Colors.primary : undefined}
            />
            <Text style={styles.rememberText}>Remember Me</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.signUpButton]}
            onPress={handleNavigateToSignUp}
          >
            <Text style={[styles.buttonText, styles.signUpButtonText]}>
              Create Account
            </Text>
          </TouchableOpacity>

          {/* Google Sign-In Button */}
          <TouchableOpacity
             style={[styles.button, styles.googleButton]}
             onPress={handleGoogleSignIn}
           >
             <Image
               source={require('../../assets/google-icon.png')}
               style={{ width: 24, height: 24, marginRight: 8 }}
               resizeMode="contain"
             />
             <Text style={[styles.buttonText, styles.googleButtonText]}>
               Sign in with Google
             </Text>
           </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={handleForgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#222',
    fontWeight: '600',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.large,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 400,
  },
  contentWide: {
    padding: Spacing.xlarge,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xlarge,
  },
  title: {
    ...Typography.heading,
    fontSize: 32,
    color: Colors.primary,
    marginBottom: Spacing.small,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.muted,
  },
  form: {
    gap: Spacing.medium,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.medium,
    ...Typography.body,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 1,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: Spacing.medium,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.textLight,
  },
  signUpButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  signUpButtonText: {
    color: Colors.primary,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: Spacing.small,
  },
  forgotPasswordText: {
    ...Typography.button,
    color: Colors.primary,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.small,
  },
  rememberText: {
    ...Typography.body,
    color: Colors.text,
    marginLeft: Spacing.small,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.small,
  },
});

export default Login;

