import React from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import Theme from '../styles/theme';

interface FAQModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FAQItemProps {
  question: string;
  answer: string;
  userJourney?: string;
}

const FAQModal: React.FC<FAQModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();

  const faqItems: FAQItemProps[] = [
    {
      question: "How do I journal my daily tasks?",
      answer: "DailyX makes journaling simple! When creating or completing a task, you can add notes about your experience, challenges, or achievements. These notes become part of your task history, helping you reflect on your progress over time.",
      userJourney: "Create a task → Add detailed notes → Complete task → Review in task history"
    },
    {
      question: "What happens when I complete a task?",
      answer: "When you complete a task, you earn XP based on the task's difficulty. Your streak counter increases, and the task is marked as complete in your history. For recurring tasks, they'll reset the next day so you can build consistent habits.",
      userJourney: "Tap confirm to complete task → Earn XP → Task moves to completed section"
    },
    {
      question: "How do I save my mood for the day?",
      answer: "You can select your mood in the Journal section each day. This allows you to track how your emotional state aligns with your habits and productivity over time.",
      userJourney: "Open Journal → Select mood → Reflect → Save your mood and entry"
    },
    {
      question: "Can I use DailyX to track my daily hustle?",
      answer: "Absolutely! Use the journal to record thoughts, progress, struggles, or wins from your day. It's a space designed to celebrate your hustle and keep you motivated.",
      userJourney: "Open Journal → Write your thoughts → Reflect on your hustle → Save entry"
    },
    {
      question: "What History does In DailyX ?",
      answer: "History in DailyX is a record of your completed tasks and their associated XP. It helps you track your progress and the reward (XP) associated with each task over time.",
      userJourney: "Open History → Check Your Task Being Completed ,Modified Or Deleted and How you assigned the reward (XP) upon modification."
    },
    {
      question: "Why you cant delete a Completed Tasks In DailyX ?",
      answer: "In DailyX, completing a task represents real progress — it's tied to a reward (XP) you've earned. Since each completed task marks an achievement, it can't be deleted to protect your hard work and rewards."
    }
  ];

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
      width: '90%',
      maxHeight: '80%',
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
    faqItem: {
      marginBottom: Theme.Spacing.lg,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: Theme.Spacing.md,
      ...Theme.Shadows.small,
    },
    question: {
      ...Theme.Typography.h4,
      color: colors.primary,
      marginBottom: Theme.Spacing.xs,
      fontWeight: '600',
    },
    answer: {
      ...Theme.Typography.body,
      color: colors.text,
      marginBottom: Theme.Spacing.sm,
    },
    journeyContainer: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: Theme.Spacing.sm,
      marginTop: Theme.Spacing.xs,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    journeyTitle: {
      ...Theme.Typography.caption,
      color: colors.textSecondary,
      marginBottom: 4,
      fontWeight: '500',
    },
    journeyText: {
      ...Theme.Typography.body,
      color: colors.text,
      fontStyle: 'italic',
    }
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Frequently Asked Questions</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView showsVerticalScrollIndicator={false}>
            {faqItems.map((item, index) => (
              <View key={index} style={styles.faqItem}>
                <Text style={styles.question}>{item.question}</Text>
                <Text style={styles.answer}>{item.answer}</Text>
                
                {item.userJourney && (
                  <View style={styles.journeyContainer}>
                    <Text style={styles.journeyTitle}>USER JOURNEY</Text>
                    <Text style={styles.journeyText}>{item.userJourney}</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default FAQModal;
