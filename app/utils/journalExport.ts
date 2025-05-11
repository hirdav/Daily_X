import { FIREBASE_DB } from '../../FirebaseConfig';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import moment from 'moment';

interface JournalEntry {
  thought: string;
  entry: string;
  mood?: string;
  timestamp: Timestamp | Date;
  date?: string;
}

/**
 * Exports a user's journal entries to a text file
 * @param userId The user ID whose journal entries to export
 * @param startDate Optional start date to filter entries (format: YYYY-MM-DD)
 * @param endDate Optional end date to filter entries (format: YYYY-MM-DD)
 * @returns Promise that resolves when the export is complete
 */
export const exportJournalToText = async (
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<void> => {
  try {
    // Create a reference to the user's journal collection
    const journalRef = collection(FIREBASE_DB, 'users', userId, 'journal');
    
    // Create a query to get all journal entries, ordered by timestamp
    const journalQuery = query(journalRef, orderBy('timestamp', 'desc'));
    
    // Get the documents
    const snapshot = await getDocs(journalQuery);
    
    // Filter by date range if provided
    let entries = snapshot.docs.map(doc => ({
      date: doc.id,
      ...(doc.data() as JournalEntry)
    }));
    
    if (startDate) {
      const startMoment = moment(startDate, 'YYYY-MM-DD');
      entries = entries.filter(entry => moment(entry.date, 'YYYY-MM-DD').isSameOrAfter(startMoment));
    }
    
    if (endDate) {
      const endMoment = moment(endDate, 'YYYY-MM-DD');
      entries = entries.filter(entry => moment(entry.date, 'YYYY-MM-DD').isSameOrBefore(endMoment));
    }
    
    // Sort entries by date (newest first)
    entries.sort((a, b) => moment(b.date).diff(moment(a.date)));
    
    // Create text content
    let textContent = `# DailyX Journal Export\n\n`;
    textContent += `Exported on: ${moment().format('MMMM D, YYYY [at] h:mm A')}\n`;
    textContent += `Total Entries: ${entries.length}\n\n`;
    
    // Add each journal entry to the text content
    entries.forEach(entry => {
      const entryDate = moment(entry.date, 'YYYY-MM-DD').format('MMMM D, YYYY');
      
      textContent += `## ${entryDate}\n\n`;
      
      if (entry.mood) {
        textContent += `Mood: ${entry.mood}\n\n`;
      }
      
      if (entry.thought) {
        textContent += `### Today's Thought\n${entry.thought}\n\n`;
      }
      
      if (entry.entry) {
        textContent += `### Journal Entry\n${entry.entry}\n\n`;
      }
      
      textContent += `---\n\n`;
    });
    
    // Create a temporary file
    const fileUri = `${FileSystem.documentDirectory}journal_export_${moment().format('YYYYMMDD_HHmmss')}.txt`;
    
    // Write the text content to the file
    await FileSystem.writeAsStringAsync(fileUri, textContent);
    
    // Share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting journal:', error);
    throw error;
  }
};

/**
 * Downloads a user's journal entries as a text file to the device
 * This function will work properly when the app is built as an APK
 * @param userId The user ID whose journal entries to download
 * @param startDate Optional start date to filter entries (format: YYYY-MM-DD)
 * @param endDate Optional end date to filter entries (format: YYYY-MM-DD)
 * @returns Promise that resolves when the download is complete
 */
export const downloadJournalAsTextFile = async (
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<void> => {
  try {
    // Request permissions first (required for saving to media library)
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Media library permission is required to save files');
    }

    // Create a reference to the user's journal collection
    const journalRef = collection(FIREBASE_DB, 'users', userId, 'journal');
    
    // Create a query to get all journal entries, ordered by timestamp
    const journalQuery = query(journalRef, orderBy('timestamp', 'desc'));
    
    // Get the documents
    const snapshot = await getDocs(journalQuery);
    
    // Filter by date range if provided
    let entries = snapshot.docs.map(doc => ({
      date: doc.id,
      ...(doc.data() as JournalEntry)
    }));
    
    if (startDate) {
      const startMoment = moment(startDate, 'YYYY-MM-DD');
      entries = entries.filter(entry => moment(entry.date, 'YYYY-MM-DD').isSameOrAfter(startMoment));
    }
    
    if (endDate) {
      const endMoment = moment(endDate, 'YYYY-MM-DD');
      entries = entries.filter(entry => moment(entry.date, 'YYYY-MM-DD').isSameOrBefore(endMoment));
    }
    
    // Sort entries by date (newest first)
    entries.sort((a, b) => moment(b.date).diff(moment(a.date)));
    
    // Create text content
    let textContent = `# DailyX Journal Export\n\n`;
    textContent += `Exported on: ${moment().format('MMMM D, YYYY [at] h:mm A')}\n`;
    textContent += `Total Entries: ${entries.length}\n\n`;
    
    // Add each journal entry to the text content
    entries.forEach(entry => {
      const entryDate = moment(entry.date, 'YYYY-MM-DD').format('MMMM D, YYYY');
      
      textContent += `## ${entryDate}\n\n`;
      
      if (entry.mood) {
        textContent += `Mood: ${entry.mood}\n\n`;
      }
      
      if (entry.thought) {
        textContent += `### Today's Thought\n${entry.thought}\n\n`;
      }
      
      if (entry.entry) {
        textContent += `### Journal Entry\n${entry.entry}\n\n`;
      }
      
      textContent += `---\n\n`;
    });
    
    // Create a filename
    const filename = `journal_export_${moment().format('YYYYMMDD_HHmmss')}.txt`;
    
    // Create a temporary file
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    
    // Write the text content to the file
    await FileSystem.writeAsStringAsync(fileUri, textContent);
    
    try {
      // Different handling based on platform
      if (Platform.OS === 'android') {
        // For Android: First create the asset, then add to album
        const asset = await MediaLibrary.createAssetAsync(fileUri);
        
        // Create the album if it doesn't exist and add the asset to it
        const album = await MediaLibrary.getAlbumAsync('DailyX');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('DailyX', asset, false);
        }
        
        return;
      } else if (Platform.OS === 'ios') {
        // For iOS: Save to camera roll
        await MediaLibrary.createAssetAsync(fileUri);
        return;
      }
      
      // Fallback to sharing if we can't save directly
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        throw new Error('Saving to device is not available in this environment');
      }
    } catch (error: any) {
      console.error('Error saving file:', error);
      
      // If saving fails, try sharing as fallback
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
        return;
      }
      
      throw new Error(`Could not save file: ${error.message}`);
    }
  } catch (error: any) {
    console.error('Error downloading journal:', error);
    throw new Error(error.message || 'Failed to download journal');
  }
};

/**
 * Exports a specific journal entry to text
 * @param userId The user ID
 * @param entryDate The specific date of the entry to export (format: YYYY-MM-DD)
 * @returns Promise that resolves when the export is complete
 */
export const exportSingleJournalEntryToText = async (
  userId: string,
  entryDate: string
): Promise<void> => {
  try {
    // Export just the single date by setting both start and end date to the same value
    await exportJournalToText(userId, entryDate, entryDate);
  } catch (error) {
    console.error(`Error exporting journal entry for ${entryDate}:`, error);
    throw error;
  }
};
