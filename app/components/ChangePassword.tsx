import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH } from '../../FirebaseConfig';
import { 
  updatePassword, 
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { Colors, Typography, Spacing } from '../styles/global';

interface ChangePasswordProps {
  visible: boolean;
  onClose: () => void;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({
  visible,
  onClose
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState(false);
  const [currentPasswordAttempts, setCurrentPasswordAttempts] = useState(0);
  
  const user = FIREBASE_AUTH.currentUser;

  const validatePassword = (password: string): boolean => {
    // Password must be at least 8 characters and contain at least one number and one letter
    return password.length >= 8 && 
           /[0-9]/.test(password) && 
           /[a-zA-Z]/.test(password);
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'User not found or not logged in');
      return;
    }
    
    // Validate inputs
    if (!currentPassword) {
      setCurrentPasswordError(true);
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    // Reset error state when attempting with a new password
    setCurrentPasswordError(false);
    
    if (!validatePassword(newPassword)) {
      Alert.alert(
        'Invalid Password', 
        'Password must be at least 8 characters and contain at least one number and one letter'
      );
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      Alert.alert('Success', 'Password updated successfully');
      
      // Clear form and close modal
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (error: any) {
      // Only log non-password related errors
      if (error.code !== 'auth/wrong-password' && error.code !== 'auth/invalid-credential') {
        console.error('Error changing password:', error);
      }
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setCurrentPasswordError(true);
        setCurrentPasswordAttempts(prev => prev + 1);
        
        if (currentPasswordAttempts >= 2) {
          Alert.alert(
            'Password Incorrect', 
            'The current password you entered doesn\'t match our records. Please try again or use the "Forgot Password" option if you can\'t remember your password.'
          );
        } else {
          Alert.alert('Error', 'Current password is incorrect');
        }
      } else {
        Alert.alert('Error', 'Failed to change password. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Change Password</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.form}>
            <Text style={styles.label}>Current Password</Text>
            <View style={[styles.passwordContainer, currentPasswordError && styles.passwordContainerError]}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={Colors.muted}
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <MaterialIcons 
                  name={showCurrentPassword ? 'visibility-off' : 'visibility'} 
                  size={24} 
                  color={Colors.muted} 
                />
              </TouchableOpacity>
            </View>
            {currentPasswordError && (
              <Text style={styles.errorText}>
                {currentPasswordAttempts >= 2 
                  ? 'Incorrect password. Need help remembering?' 
                  : 'Current password is incorrect'}
              </Text>
            )}
            
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={Colors.muted}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <MaterialIcons 
                  name={showNewPassword ? 'visibility-off' : 'visibility'} 
                  size={24} 
                  color={Colors.muted} 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.passwordRequirements}>
              Password must be at least 8 characters and contain at least one number and one letter
            </Text>
            
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.muted}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <MaterialIcons 
                  name={showConfirmPassword ? 'visibility-off' : 'visibility'} 
                  size={24} 
                  color={Colors.muted} 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton, loading && styles.disabledButton]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    width: '90%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.medium,
    paddingBottom: Spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.heading,
    fontSize: 20,
  },
  form: {
    marginTop: Spacing.small,
  },
  label: {
    ...Typography.caption,
    color: Colors.muted,
    marginBottom: Spacing.tiny,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: Spacing.small,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: Spacing.medium,
    color: Colors.text,
  },
  eyeIcon: {
    padding: Spacing.small,
  },
  passwordRequirements: {
    ...Typography.caption,
    color: Colors.muted,
    marginBottom: Spacing.medium,
    fontSize: 11,
  },
  passwordContainerError: {
    borderColor: Colors.error,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginBottom: Spacing.small,
    marginTop: -Spacing.tiny,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.medium,
  },
  button: {
    flex: 1,
    padding: Spacing.medium,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
    marginRight: Spacing.small,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    marginLeft: Spacing.small,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.text,
  },
  saveButtonText: {
    ...Typography.body,
    color: Colors.textLight,
    fontWeight: 'bold',
  },
});

export default ChangePassword;
