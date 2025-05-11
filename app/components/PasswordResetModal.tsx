import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import Theme from '../styles/theme';
import { FIREBASE_AUTH } from '../../FirebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';

interface PasswordResetModalProps {
  visible: boolean;
  onClose: () => void;
}

const PasswordResetModal: React.FC<PasswordResetModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendResetEmail = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(FIREBASE_AUTH, email);
      setIsSuccess(true);
    } catch (error: any) {
      let errorMessage = 'Failed to send password reset email';
      
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please try again later';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection';
            break;
          default:
            errorMessage = `Error: ${error.message}`;
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state when closing
    setEmail('');
    setEmailError('');
    setIsSuccess(false);
    onClose();
  };

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      width: '90%',
      maxWidth: 400,
      backgroundColor: colors.cardBackground || colors.surface,
      borderRadius: 16,
      padding: Theme.Spacing.md,
      ...Theme.Shadows.medium,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Theme.Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: Theme.Spacing.sm,
    },
    title: {
      ...Theme.Typography.h3,
      color: colors.text,
      fontWeight: '600',
    },
    closeButton: {
      padding: Theme.Spacing.xs,
    },
    description: {
      ...Theme.Typography.body,
      color: colors.text,
      marginBottom: Theme.Spacing.md,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: Theme.Spacing.md,
      color: colors.text,
      marginBottom: Theme.Spacing.sm,
      borderWidth: emailError ? 1 : 0,
      borderColor: colors.error,
    },
    errorText: {
      ...Theme.Typography.caption,
      color: colors.error,
      marginBottom: Theme.Spacing.sm,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: Theme.Spacing.md,
      alignItems: 'center',
      marginTop: Theme.Spacing.sm,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textLight,
    },
    successContainer: {
      alignItems: 'center',
      padding: Theme.Spacing.md,
    },
    successIcon: {
      marginBottom: Theme.Spacing.md,
    },
    successText: {
      ...Theme.Typography.body,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Theme.Spacing.md,
    },
    emailText: {
      ...Theme.Typography.body,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: Theme.Spacing.md,
    }
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {isSuccess ? (
            <View style={styles.successContainer}>
              <MaterialIcons 
                name="check-circle" 
                size={48} 
                color={colors.success || colors.primary} 
                style={styles.successIcon}
              />
              <Text style={styles.successText}>
                Password reset link has been sent to:
              </Text>
              <Text style={styles.emailText}>{email}</Text>
              <Text style={styles.successText}>
                Please check your email and follow the instructions to reset your password.
              </Text>
              <TouchableOpacity style={styles.button} onPress={handleClose}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.description}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>
              
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
              
              <TouchableOpacity 
                style={styles.button} 
                onPress={handleSendResetEmail}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default PasswordResetModal;
