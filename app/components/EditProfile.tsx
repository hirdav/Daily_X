import React, { useState, useEffect } from 'react';
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
  Platform,
  ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Colors, Typography, Spacing } from '../styles/global';
import ProfilePictureSelector from './ProfilePictureSelector';

interface EditProfileProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

const EditProfile: React.FC<EditProfileProps> = ({
  visible,
  onClose,
  onProfileUpdated
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profilePictureId, setProfilePictureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const user = FIREBASE_AUTH.currentUser;

  useEffect(() => {
    if (visible && user) {
      // Load additional user data from Firestore
      const loadUserData = async () => {
        try {
          const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setFullName(userData.fullName || '');
            setUsername(userData.username || '');
            setBio(userData.bio || '');
            setProfilePictureId(userData.profilePictureId || null);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };
      
      loadUserData();
    }
  }, [visible, user]);

  const handleSave = async () => {
    if (!user) return;
    
    // Validate inputs
    let hasError = false;
    let errorMessage = '';
    
    if (!fullName.trim()) {
      hasError = true;
      errorMessage = 'Full name cannot be empty';
    } else if (!username.trim()) {
      hasError = true;
      errorMessage = 'Username cannot be empty';
    } else if (username.trim().length < 4 || username.trim().length > 10) {
      hasError = true;
      errorMessage = 'Username must be between 4 and 10 characters';
    }
    
    if (hasError) {
      Alert.alert('Error', errorMessage);
      return;
    }
    
    setLoading(true);
    try {
      // Update additional user data in Firestore
      const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
      
      try {
        await updateDoc(userDocRef, {
          fullName: fullName.trim(),
          bio: bio.trim(),
          username: username.trim(),
          lastUpdated: new Date()
        });
      } catch (updateError) {
        // If document doesn't exist yet, create it
        console.log('Creating new user document');
        await setDoc(userDocRef, {
          fullName: fullName.trim(),
          bio: bio.trim(),
          username: username.trim(),
          email: user.email,
          profilePictureId: profilePictureId,
          lastUpdated: new Date()
        });
      }
      
      if (onProfileUpdated) {
        onProfileUpdated();
      }
      
      Alert.alert('Success', 'Profile updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
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
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.form}>
            <View style={styles.profilePictureContainer}>
              <ProfilePictureSelector 
                size={120} 
                onPictureChange={(pictureId) => setProfilePictureId(pictureId)}
              />
            </View>
            
            <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={Colors.muted}
              autoCapitalize="words"
              returnKeyType="next"
            />
            
            <Text style={styles.label}>Username <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              placeholderTextColor={Colors.muted}
              autoCapitalize="none"
              returnKeyType="next"
            />
            <Text style={styles.helperText}>Username must be between 4 and 10 characters</Text>
            
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor={Colors.muted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={150}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
            
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
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
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
    fontWeight: 'bold',
  },
  form: {
    marginTop: Spacing.small,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: Spacing.large,
  },
  label: {
    ...Typography.caption,
    color: Colors.text,
    marginBottom: Spacing.tiny,
    fontWeight: '500',
  },
  required: {
    color: Colors.error,
    fontWeight: 'bold',
  },
  helperText: {
    ...Typography.caption,
    color: Colors.muted,
    marginTop: -Spacing.small,
    marginBottom: Spacing.medium,
    fontSize: 12,
  },
  charCount: {
    ...Typography.caption,
    color: Colors.muted,
    textAlign: 'right',
    marginTop: -Spacing.small,
    marginBottom: Spacing.medium,
    fontSize: 12,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: Spacing.medium,
    marginBottom: Spacing.medium,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.medium,
    marginBottom: Spacing.large,
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

export default EditProfile;
