/**
 * Utility functions for working with Redux
 */

/**
 * Converts Firestore Timestamp objects to serializable date strings
 * to prevent Redux serialization errors
 */
export const serializeFirestoreData = (data: any): any => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => serializeFirestoreData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    // Check if it's a Firestore Timestamp
    if (data.seconds !== undefined && data.nanoseconds !== undefined) {
      // Convert to ISO string for serialization
      return new Date(data.seconds * 1000).toISOString();
    }
    
    // Process nested objects
    const result: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = serializeFirestoreData(data[key]);
      }
    }
    return result;
  }
  
  return data;
};
