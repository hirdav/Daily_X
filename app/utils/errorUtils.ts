/**
 * Error utility functions for DailyX
 * 
 * This module provides helper functions for error handling, retries, and logging
 */

/**
 * Helper function to determine if an error is retryable
 * This helps with network resilience by retrying operations that might succeed on a subsequent attempt
 * 
 * @param error - The error to check
 * @returns boolean indicating if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  
  // Convert to string for pattern matching
  const errorString = String(error);
  const errorMessage = error instanceof Error ? error.message : errorString;
  
  // Network-related errors that might be transient
  const retryablePatterns = [
    'network error',
    'timeout',
    'unavailable',
    'internal',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'NETWORK_ERROR',
    'failed to get document because the client is offline',
    'resource exhausted',
    'deadline-exceeded',
    'cancelled',
    'firestore/unavailable',
    'firestore/resource-exhausted'
  ];
  
  // Check if error message matches any retryable pattern
  return retryablePatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Enhanced error logging with context
 * 
 * @param context - Context information about where the error occurred
 * @param error - The error object
 * @param additionalInfo - Any additional information to include
 */
export function logErrorWithContext(
  context: string,
  error: unknown,
  additionalInfo: Record<string, any> = {}
): void {
  console.error(`[${context}] Error:`, error);
  console.error(`[${context}] Details:`, {
    timestamp: new Date().toISOString(),
    errorType: error?.constructor?.name || 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...additionalInfo
  });
}
