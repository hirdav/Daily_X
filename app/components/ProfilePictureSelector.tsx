import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Text,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, fontSizes } from '../styles/global';
// Import Firestore functions separately to avoid any potential issues
import { doc } from 'firebase/firestore';
import { updateDoc } from 'firebase/firestore';
import { getDoc } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { FIREBASE_DB, FIREBASE_AUTH } from '../../FirebaseConfig';

// Define the available profile pictures with proper require statements to ensure images load correctly
const profilePictures = [
  { id: '1', source: require('../../assets/PP/10403890.jpg') },
  { id: '2', source: require('../../assets/PP/11365285.jpg') },
  { id: '3', source: require('../../assets/PP/11488937.jpg') },
  { id: '4', source: require('../../assets/PP/4300_11_04.jpg') },
  { id: '5', source: require('../../assets/PP/6111556.jpg') },
  { id: '6', source: require('../../assets/PP/7665086.jpg') },
  { id: '7', source: require('../../assets/PP/9751729.jpg') },
];

// Fallback image in case the required images fail to load - using an existing image from PP folder
const DEFAULT_PROFILE_IMAGE = require('../../assets/PP/10403890.jpg');

interface ProfilePictureSelectorProps {
  size?: number;
  onPictureChange?: (pictureId: string) => void;
  showEditButton?: boolean;
  readOnly?: boolean;
}

const ProfilePictureSelector: React.FC<ProfilePictureSelectorProps> = ({
  size = 80,
  onPictureChange,
  showEditButton = true,
  readOnly = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPicture, setSelectedPicture] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const user = FIREBASE_AUTH.currentUser;
  
  // Fetch the user's current profile picture selection
  useEffect(() => {
    if (!user) return;
    
    // Initial fetch of profile picture
    const fetchProfilePicture = async () => {
      try {
        // Make sure we're using the correct import for doc function
        const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().profilePictureId) {
          setSelectedPicture(userDoc.data().profilePictureId);
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      }
    };
    
    fetchProfilePicture();
    
    // Set up real-time listener for profile picture changes
    const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists() && doc.data().profilePictureId) {
        setSelectedPicture(doc.data().profilePictureId);
      }
    }, (error) => {
      console.error('Error in profile picture listener:', error);
    });
    
    // Clean up listener on unmount
    return () => unsubscribe();
  }, [user]);
  
  // Save the selected profile picture to Firestore
  const saveProfilePicture = async (pictureId: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Make sure we're using the correct import for doc function
      const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
      await updateDoc(userDocRef, {
        profilePictureId: pictureId,
        lastUpdated: new Date()
      });
      
      if (onPictureChange) {
        onPictureChange(pictureId);
      }
    } catch (error) {
      console.error('Error saving profile picture:', error);
      // If the document doesn't exist yet, create it
      try {
        // Make sure we're using the correct import for doc function
        const userDocRef = doc(FIREBASE_DB, 'users', user.uid);
        await updateDoc(userDocRef, {
          profilePictureId: pictureId,
          email: user.email,
          lastUpdated: new Date()
        });
      } catch (innerError) {
        console.error('Error creating user document:', innerError);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle selecting a profile picture
  const handleSelectPicture = (pictureId: string) => {
    if (readOnly) return;
    
    setSelectedPicture(pictureId);
    saveProfilePicture(pictureId);
    setModalVisible(false);
  };
  
  // Get the selected profile picture source
  const getSelectedPictureSource = () => {
    if (!selectedPicture) return null;
    
    const picture = profilePictures.find(p => p.id === selectedPicture);
    return picture ? picture.source : null;
  };
  
  return (
    <View>
      <TouchableOpacity
        onPress={() => !readOnly && setModalVisible(true)}
        style={[styles.profilePicture, { width: size, height: size, borderRadius: size / 2 }]}
        disabled={readOnly || loading}
      >
        {selectedPicture ? (
          <Image
            source={profilePictures.find(pic => pic.id === selectedPicture)?.source || DEFAULT_PROFILE_IMAGE}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            defaultSource={DEFAULT_PROFILE_IMAGE}
            onError={(e) => console.log('Error loading profile image:', e.nativeEvent.error)}
          />
        ) : (
          <View style={[styles.placeholderContainer, { width: size, height: size, borderRadius: size / 2 }]}>
            <MaterialIcons name="person" size={size * 0.6} color={Colors.muted} />
          </View>
        )}
        {showEditButton && !readOnly && (
          <View style={styles.editIconContainer}>
            {loading ? (
              <View style={styles.loadingIndicator} />
            ) : (
              <MaterialIcons name="edit" size={size * 0.2} color={Colors.white} />
            )}
          </View>
        )}
      </TouchableOpacity>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Profile Picture</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={profilePictures}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pictureItem,
                    selectedPicture === item.id && styles.selectedPicture,
                  ]}
                  onPress={() => handleSelectPicture(item.id)}
                >
                  <Image 
                    source={item.source} 
                    style={styles.pictureImage}
                    defaultSource={DEFAULT_PROFILE_IMAGE}
                    onError={(e) => console.log('Error loading grid image:', e.nativeEvent.error)}
                  />
                  {selectedPicture === item.id && (
                    <View style={styles.selectedOverlay}>
                      <MaterialIcons name="check" size={24} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.pictureGrid}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { width } = Dimensions.get('window');
const pictureSize = (width - 60) / 3;

const styles = StyleSheet.create({
  profilePicture: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderContainer: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    padding: 4,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.white,
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.medium,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.medium,
  },
  modalTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: Colors.text,
  },
  closeButton: {
    padding: Spacing.small,
  },
  pictureGrid: {
    marginTop: Spacing.small,
  },
  pictureItem: {
    margin: Spacing.small,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPicture: {
    borderColor: Colors.primary,
  },
  pictureImage: {
    width: pictureSize,
    height: pictureSize,
    borderRadius: 8,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
});

export default ProfilePictureSelector;
