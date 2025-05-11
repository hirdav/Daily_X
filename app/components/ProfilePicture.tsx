import React, { useState, useEffect } from 'react';
import { 
  View, 
  Image, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  Platform,
  Text
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../styles/global';
import { FIREBASE_AUTH, FIREBASE_STORAGE } from '../../FirebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import * as FileSystem from 'expo-file-system';

// Maximum size for profile picture in bytes (100KB)
const MAX_IMAGE_SIZE = 100 * 1024; 

interface ProfilePictureProps {
  size?: number;
  onImageUpdated?: (url: string | null) => void;
}

const ProfilePicture: React.FC<ProfilePictureProps> = ({ 
  size = 100,
  onImageUpdated 
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const user = FIREBASE_AUTH.currentUser;

  useEffect(() => {
    // Load the user's profile picture if available
    if (user?.photoURL) {
      setImage(user.photoURL);
    }
  }, [user]);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
        return false;
      }
      return true;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      
      // Note: We're still using MediaTypeOptions for compatibility, but we should
      // update to MediaType in the future when we upgrade expo-image-picker

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Check file size
        const response = await fetch(selectedAsset.uri);
        const blob = await response.blob();
        
        if (blob.size > MAX_IMAGE_SIZE) {
          Alert.alert(
            'Image Too Large', 
            `The selected image is ${(blob.size / 1024).toFixed(1)}KB. Please select an image smaller than 100KB.`
          );
          return;
        }
        
        // Upload the image
        await uploadProfilePicture(selectedAsset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadProfilePicture = async (uri: string) => {
    setLoading(true);
    
    try {
      const user = FIREBASE_AUTH.currentUser;
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Delete existing profile picture if it exists
      if (user.photoURL) {
        try {
          // Extract the filename from the URL
          const urlParts = user.photoURL.split('/');
          const filename = urlParts[urlParts.length - 1].split('?')[0];
          const oldStorageRef = ref(FIREBASE_STORAGE, `profilePictures/${filename}`);
          
          await deleteObject(oldStorageRef);
          console.log('Old profile picture deleted successfully');
        } catch (deleteError) {
          // Don't throw here, just log the error and continue
          console.warn('Failed to delete old profile picture:', deleteError);
        }
      }
      
      // Check if Firebase Storage is initialized
      if (!FIREBASE_STORAGE) {
        throw new Error('Firebase Storage is not initialized');
      }

      // Process and compress the image before uploading
      console.log('Starting profile picture upload process...');
      
      // 1. Get image info to check size
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log(`Original image size: ${fileInfo.size ? (fileInfo.size / 1024).toFixed(2) : 'unknown'} KB`);
      
      // 2. Compress the image if it's too large
      let processedUri = uri;
      if (fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
        console.log('Image is too large, compressing...');
        
        // Determine compression quality based on file size
        // The larger the file, the more we compress
        const ratio = MAX_IMAGE_SIZE / fileInfo.size;
        const quality = Math.max(0.1, Math.min(0.7, ratio));
        
        // Create a new filename for the compressed image
        const timestamp = new Date().getTime();
        const newUri = FileSystem.documentDirectory + `temp_${timestamp}.jpg`;
        
        try {
          // Compress the image
          await FileSystem.manipulateAsync(
            uri,
            [], // no operations
            { compress: quality, format: 'jpeg', output: newUri }
          );
          
          // Update the URI to the compressed image
          processedUri = newUri;
          
          // Check the new file size
          const newFileInfo = await FileSystem.getInfoAsync(processedUri);
          console.log(`Compressed image size: ${newFileInfo.size ? (newFileInfo.size / 1024).toFixed(2) : 'unknown'} KB`);
        } catch (compressError) {
          console.error('Error compressing image:', compressError);
          // Continue with the original image if compression fails
        }
      }
      
      // 3. Read the file as base64
      console.log('Reading image data...');
      const base64Data = await FileSystem.readAsStringAsync(processedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // 4. Determine content type based on URI
      let contentType = 'image/jpeg'; // Default
      if (processedUri.toLowerCase().endsWith('.png')) {
        contentType = 'image/png';
      } else if (processedUri.toLowerCase().endsWith('.gif')) {
        contentType = 'image/gif';
      } else if (processedUri.toLowerCase().endsWith('.webp')) {
        contentType = 'image/webp';
      }
      
      // 5. Create a unique filename
      const timestamp = new Date().getTime();
      const filename = `${user.uid}_${timestamp}`;
      const storageRef = ref(FIREBASE_STORAGE, `profilePictures/${filename}`);
      console.log(`Storage reference created: profilePictures/${filename}`);
      
      // 6. Create metadata
      const metadata = {
        contentType: contentType,
        cacheControl: 'public,max-age=86400', // 24 hour cache
      };
      
      // 7. Upload the image directly from the file URI instead of creating a Blob
      // This approach works better on React Native, especially on Android
      console.log('Preparing to upload image...');
      
      try {
        // For React Native, we'll use a different approach that doesn't rely on Blob
        // First, create a fetch request to the local file
        const fetchResponse = await fetch(processedUri);
        
        // Get the binary data as an array buffer
        const arrayBuffer = await fetchResponse.arrayBuffer();
        
        // Convert to Uint8Array which is supported by Firebase Storage
        const uint8Array = new Uint8Array(arrayBuffer);
        
        console.log(`Image prepared for upload. Size: ${(uint8Array.length / 1024).toFixed(2)}KB`);
        
        // Upload using uploadBytes which accepts Uint8Array
        console.log('Uploading image to Firebase Storage...');
        await uploadBytes(storageRef, uint8Array, metadata);
        console.log('Upload successful!');
      } catch (uploadError: any) {
        console.error('Error during upload process:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError?.message || 'unknown error'}. Please try again with a smaller image.`);
      }
      
      // 9. Get download URL
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Download URL obtained');
      
      // 10. Clean up temporary file if we created one
      if (processedUri !== uri) {
        try {
          await FileSystem.deleteAsync(processedUri);
          console.log('Temporary file cleaned up');
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file:', cleanupError);
        }
      }
      
      // Update user profile
      await updateProfile(user, {
        photoURL: downloadURL
      });
      
      setImage(downloadURL);
      
      if (onImageUpdated) {
        onImageUpdated(downloadURL);
      }
      
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      
      // Log additional debugging information
      console.log('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        serverResponse: error.serverResponse || 'No server response',
        name: error.name
      });
      
      // Provide more detailed error message
      let errorMessage = 'Failed to upload profile picture';
      
      if (error.code) {
        switch(error.code) {
          case 'storage/unauthorized':
            errorMessage = 'You do not have permission to upload images';
            break;
          case 'storage/canceled':
            errorMessage = 'Upload was canceled';
            break;
          case 'storage/unknown':
            errorMessage = 'An unknown error occurred during upload. Please try using a smaller image (under 100KB) or check your internet connection.';
            break;
          case 'storage/quota-exceeded':
            errorMessage = 'Storage quota exceeded. Please try a smaller image.';
            break;
          case 'storage/invalid-format':
            errorMessage = 'Invalid image format. Please try a different image.';
            break;
          case 'storage/object-not-found':
            errorMessage = 'The specified object does not exist.';
            break;
          case 'storage/bucket-not-found':
            errorMessage = 'The storage bucket does not exist.';
            break;
          case 'storage/project-not-found':
            errorMessage = 'The storage project does not exist.';
            break;
          case 'storage/unauthenticated':
            errorMessage = 'User is not authenticated. Please log in again.';
            break;
        }
      } else if (error.message) {
        // Use the error message directly if available
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const removeProfilePicture = async () => {
    if (!user) return;
    
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              if (user.photoURL && user.photoURL.includes('firebase')) {
                const imageRef = ref(FIREBASE_STORAGE, `profilePictures/${user.uid}`);
                await deleteObject(imageRef);
              }
              
              await updateProfile(user, {
                photoURL: null
              });
              
              setImage(null);
              
              if (onImageUpdated) {
                onImageUpdated(null);
              }
              
              Alert.alert('Success', 'Profile picture removed');
            } catch (error) {
              console.error('Error removing profile picture:', error);
              Alert.alert('Error', 'Failed to remove profile picture');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} />
      ) : (
        <>
          {image ? (
            <Image 
              source={{ uri: image }} 
              style={[styles.image, { width: size, height: size }]} 
            />
          ) : (
            <MaterialIcons name="account-circle" size={size} color={Colors.primary} />
          )}
          
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: Colors.primary }]} 
              onPress={pickImage}
            >
              <MaterialIcons name="add-a-photo" size={16} color="#fff" />
            </TouchableOpacity>
            
            {image && (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: Colors.error }]} 
                onPress={removeProfilePicture}
              >
                <MaterialIcons name="delete" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
      <Text style={styles.sizeInfo}>Max size: 100KB</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    overflow: 'visible',
    marginBottom: 20,
  },
  image: {
    borderRadius: 50,
    backgroundColor: Colors.background,
  },
  actions: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    flexDirection: 'row',
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sizeInfo: {
    position: 'absolute',
    bottom: -20,
    fontSize: 10,
    color: Colors.muted,
  }
});

export default ProfilePicture;
