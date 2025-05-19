import { Timestamp } from 'firebase/firestore';

export interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  description?: string;
  scheduledDate: string; // ISO format date (YYYY-MM-DD) when the task is scheduled to start
  scheduledTime?: string; // Optional time in 24-hour format (HH:MM)
  dueDate?: string; // Optional ISO format date (YYYY-MM-DD) when the task is due
  repeatFrequency: 'none' | 'daily' | 'weekly' | 'monthly';
  notificationEnabled: boolean;
  status: 'upcoming' | 'completed' | 'missed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notificationId?: string; // ID for the scheduled notification (for cancellation)
}
