import { Timestamp } from 'firebase/firestore';

/**
 * Formats a Date object as YYYY-MM-DD string
 * Uses UTC to avoid timezone issues
 * @param date Date object to format
 * @returns Formatted date string
 */
export const formatDateString = (date: Date): string => {
  // Create a new date at noon UTC to avoid timezone issues
  const utcDate = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12, 0, 0
  ));
  
  return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
};

/**
 * Formats a date string in a readable format
 * @param dateStr Date string in YYYY-MM-DD format
 * @param includeYear Whether to include the year in the output
 * @returns Formatted date string (e.g., "Jan 1, 2025")
 */
export const formatDate = (dateStr: string, includeYear: boolean = true): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: includeYear ? 'numeric' : undefined 
  });
};

/**
 * Formats duration in minutes to a readable format
 * @param minutes Duration in minutes
 * @returns Formatted duration string (e.g., "2h 30m")
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  }
};

/**
 * Converts a JavaScript Date to a Firestore Timestamp
 * @param date Date object to convert
 * @returns Firestore Timestamp
 */
export const dateToTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

/**
 * Gets the start of the day for a given date
 * @param date Date object
 * @returns Date object set to the start of the day (00:00:00)
 */
export const getStartOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

/**
 * Gets the end of the day for a given date
 * @param date Date object
 * @returns Date object set to the end of the day (23:59:59)
 */
export const getEndOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

/**
 * Gets the date for n days ago
 * @param days Number of days to go back
 * @returns Date object for n days ago
 */
export const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * Calculates the number of days between two dates
 * @param start Start date
 * @param end End date
 * @returns Number of days between the dates
 */
export const getDaysBetween = (start: Date, end: Date): number => {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Gets an array of date strings for the past n days
 * Uses UTC to avoid timezone issues
 * @param days Number of days to include
 * @returns Array of date strings in YYYY-MM-DD format
 */
export const getPastDaysDateStrings = (days: number): string[] => {
  const dates: string[] = [];
  // Create today at noon UTC to avoid timezone issues
  const now = new Date();
  const today = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12, 0, 0
  ));
  
  for (let i = 0; i < days; i++) {
    // Create a new UTC date for each day
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - i);
    dates.push(formatDateString(date));
  }
  
  return dates;
};

/**
 * Gets an array of date strings for the current month up to today
 * @returns Array of date strings in YYYY-MM-DD format
 */
export const getCurrentMonthDates = (): string[] => {
  const dates: string[] = [];
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Get the number of days in the current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentYear, currentMonth, i);
    // Only include days up to today
    if (date <= today) {
      dates.push(formatDateString(date));
    }
  }
  
  return dates;
};
