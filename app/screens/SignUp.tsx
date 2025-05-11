import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Colors, Typography, Spacing, fontSizes } from '../styles/global';
import { MaterialIcons, Feather, FontAwesome } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

interface Props {
  navigation: SignUpScreenNavigationProp;
}

const SignUp: React.FC<Props> = ({ navigation }) => {
  // Comment: In a real implementation, you would need to install and configure
  // @react-native-google-signin/google-signin package and set up Google Cloud Console
  // For this UI revamp, we'll include the UI elements but not the actual implementation
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Error states
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // We'll enforce username uniqueness at the time of account creation
  // instead of querying all users (which requires special permissions)
  const validateUsername = (username: string) => {
    // Check if username meets the length requirements
    if (username.length < 4 || username.length > 10) {
      return false;
    }
    
    // Check if username contains only valid characters (letters, numbers, and underscores)
    const usernameRegex = /^[a-z0-9_]+$/;
    return usernameRegex.test(username);
  };

  const validateInputs = () => {
    let isValid = true;
    
    // Validate name
    if (!fullName.trim()) {
      setNameError('Please enter your full name');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // Validate username
    if (!username.trim()) {
      setUsernameError('Please enter a username');
      isValid = false;
    } else if (!validateUsername(username)) {
      setUsernameError('Username must be 4-10 characters and contain only letters, numbers, and underscores');
      isValid = false;
    } else {
      setUsernameError('');
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      setEmailError('');
    }
    
    // Validate password
    if (!password || password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }
    
    // Validate confirm password
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }
    
    return isValid;
  };

  const createUserDocument = async (userId: string) => {
    try {
      await setDoc(doc(FIREBASE_DB, 'users', userId), {
        fullName,
        username,
        email,
        createdAt: new Date(),
        xp: 0,
        streakCount: 0,
        lastActive: new Date(),
        // Add any other initial user data here
      });
    } catch (error) {
      console.error('Error creating user document:', error);
      Alert.alert('Error', 'Failed to initialize user data');
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    // Since we removed the async call from validateInputs, we don't need to await it
    const isValid = validateInputs();
    if (!isValid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await createUserWithEmailAndPassword(FIREBASE_AUTH, email, password);
      await createUserDocument(response.user.uid);
      
      // Navigate to main screen after successful sign up
      navigation.navigate('Main');
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Sign Up Error', error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join DailyX to become a better version of yourself</Text>
        </View>

        {/* Social buttons container removed as requested */}

        {/* No divider needed since there are no social buttons */}

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Feather name="user" size={20} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
          
          <View style={styles.inputContainer}>
            <Feather name="at-sign" size={20} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, usernameError ? styles.inputError : null]}
              placeholder="Username (4-10 characters)"
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              autoCapitalize="none"
              maxLength={10}
            />
          </View>
          {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}

          <View style={styles.inputContainer}>
            <Feather name="mail" size={20} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, emailError ? styles.inputError : null]}
              placeholder="Email Address"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={Colors.muted}
            />
          </View>
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <View style={styles.inputContainer}>
            <Feather name="lock" size={20} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, passwordError ? styles.inputError : null]}
              placeholder="Password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholderTextColor={Colors.muted}
            />
            <TouchableOpacity 
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Feather 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color={Colors.muted} 
              />
            </TouchableOpacity>
          </View>
          {password ? <View style={styles.passwordStrength}>
            <View style={[styles.strengthIndicator, styles.strengthWeak, password.length >= 6 ? styles.strengthActive : {}]} />
            <View style={[styles.strengthIndicator, styles.strengthMedium, password.length >= 8 ? styles.strengthActive : {}]} />
            <View style={[styles.strengthIndicator, styles.strengthStrong, password.length >= 10 ? styles.strengthActive : {}]} />
          </View> : null}
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          <View style={styles.inputContainer}>
            <Feather name="check-circle" size={20} color={Colors.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, confirmPasswordError ? styles.inputError : null]}
              placeholder="Confirm Password"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholderTextColor={Colors.muted}
            />
          </View>
          {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By creating an account, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Styles for the SignUp component

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.medium,
  },
  header: {
    paddingTop: Spacing.xlarge,
    paddingBottom: Spacing.small,
  },
  backButton: {
    padding: Spacing.small,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 70, 193, 0.1)',
  },
  titleContainer: {
    marginBottom: Spacing.xlarge,
    alignItems: 'center',
  },
  title: {
    ...Typography.heading,
    color: Colors.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: Spacing.small,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.muted,
    textAlign: 'center',
  },
  socialButtonsContainer: {
    marginBottom: Spacing.large,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleIcon: {
    marginRight: Spacing.small,
  },
  socialButtonText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.large,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.muted,
    paddingHorizontal: Spacing.medium,
    fontSize: 14,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: Spacing.medium,
    paddingHorizontal: Spacing.medium,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: Spacing.small,
  },
  input: {
    flex: 1,
    padding: Spacing.medium,
    color: Colors.text,
    fontSize: 16,
  },
  inputError: {
    borderColor: Colors.error,
  },
  passwordToggle: {
    padding: Spacing.small,
  },
  passwordStrength: {
    flexDirection: 'row',
    marginBottom: Spacing.medium,
    marginTop: -Spacing.small,
  },
  strengthIndicator: {
    height: 4,
    flex: 1,
    marginRight: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  strengthWeak: {
    backgroundColor: Colors.border,
  },
  strengthMedium: {
    backgroundColor: Colors.border,
  },
  strengthStrong: {
    backgroundColor: Colors.border,
  },
  strengthActive: {
    backgroundColor: Colors.primary,
  },
  errorText: {
    color: Colors.error,
    marginBottom: Spacing.medium,
    fontSize: 14,
    marginTop: -Spacing.small,
    paddingLeft: Spacing.medium,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: Spacing.medium,
    alignItems: 'center',
    marginTop: Spacing.medium,
    height: 56,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.large,
  },
  loginPromptText: {
    color: Colors.text,
    marginRight: Spacing.tiny,
  },
  loginLink: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  termsContainer: {
    marginTop: Spacing.large,
    alignItems: 'center',
    paddingHorizontal: Spacing.large,
  },
  termsText: {
    textAlign: 'center',
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '500',
  },
});

export default SignUp;
