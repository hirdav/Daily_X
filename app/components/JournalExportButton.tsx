import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Theme from '../styles/theme';
import { FIREBASE_AUTH } from '../../FirebaseConfig';
import { exportJournalToText, exportSingleJournalEntryToText, downloadJournalAsTextFile } from '../utils/journalExport';
import moment from 'moment';

interface JournalExportButtonProps {
  style?: object;
  asMenuItem?: boolean;
}

const JournalExportButton: React.FC<JournalExportButtonProps> = ({ style, asMenuItem = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specificDate, setSpecificDate] = useState('');
  const [exportMode, setExportMode] = useState<'all' | 'range' | 'specific'>('all');

  const user = FIREBASE_AUTH.currentUser;

  const handleExport = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to export journal data.');
      return;
    }

    setShareLoading(true);
    try {
      if (exportMode === 'specific' && specificDate) {
        // Validate date format
        if (!moment(specificDate, 'YYYY-MM-DD', true).isValid()) {
          throw new Error('Invalid date format. Please use YYYY-MM-DD format.');
        }
        await exportSingleJournalEntryToText(user.uid, specificDate);
      } else if (exportMode === 'range') {
        // Validate date formats
        if (startDate && !moment(startDate, 'YYYY-MM-DD', true).isValid()) {
          throw new Error('Invalid start date format. Please use YYYY-MM-DD format.');
        }
        if (endDate && !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
          throw new Error('Invalid end date format. Please use YYYY-MM-DD format.');
        }
        await exportJournalToText(user.uid, startDate, endDate);
      } else {
        // Export all
        await exportJournalToText(user.uid);
      }
      setModalVisible(false);
    } catch (error: any) {
      Alert.alert('Export Failed', error.message || 'Failed to export journal data.');
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <>
      {asMenuItem ? (
        <TouchableOpacity
          style={[styles.menuItem, style]}
          onPress={() => setModalVisible(true)}
        >
          <MaterialIcons name="file-download" size={24} color={Theme.Colors.text} />
          <Text style={styles.menuItemText}>Export Journal</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.exportButton, style]}
          onPress={() => setModalVisible(true)}
        >
          <MaterialIcons name="file-download" size={24} color="#fff" />
          <Text style={styles.exportButtonText}>Export Journal</Text>
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Journal Data</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.exportOptions}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  exportMode === 'all' && styles.selectedOption
                ]}
                onPress={() => setExportMode('all')}
              >
                <Text style={styles.optionText}>Export All Entries</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  exportMode === 'range' && styles.selectedOption
                ]}
                onPress={() => setExportMode('range')}
              >
                <Text style={styles.optionText}>Export Date Range</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  exportMode === 'specific' && styles.selectedOption
                ]}
                onPress={() => setExportMode('specific')}
              >
                <Text style={styles.optionText}>Export Specific Date</Text>
              </TouchableOpacity>
            </View>

            {exportMode === 'range' && (
              <View style={styles.dateInputs}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD):</Text>
                  <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="e.g., 2025-01-01"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>End Date (YYYY-MM-DD):</Text>
                  <TextInput
                    style={styles.input}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="e.g., 2025-04-24"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            )}

            {exportMode === 'specific' && (
              <View style={styles.dateInputs}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD):</Text>
                  <TextInput
                    style={styles.input}
                    value={specificDate}
                    onChangeText={setSpecificDate}
                    placeholder="e.g., 2025-04-24"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>
            )}

            <View style={styles.exportButtonsContainer}>
              <TouchableOpacity
                style={styles.exportActionButton}
                onPress={handleExport}
                disabled={shareLoading || downloadLoading}
              >
                {shareLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="share" size={20} color="#fff" />
                    <Text style={styles.exportActionButtonText}>Share as Text</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.exportActionButton, styles.downloadButton]}
                onPress={async () => {
                  if (!user) {
                    Alert.alert('Error', 'You must be logged in to export journal data.');
                    return;
                  }
                  
                  setDownloadLoading(true);
                  try {
                    if (exportMode === 'specific' && specificDate) {
                      if (!moment(specificDate, 'YYYY-MM-DD', true).isValid()) {
                        throw new Error('Invalid date format. Please use YYYY-MM-DD format.');
                      }
                      await downloadJournalAsTextFile(user.uid, specificDate);
                    } else if (exportMode === 'range') {
                      if (startDate && !moment(startDate, 'YYYY-MM-DD', true).isValid()) {
                        throw new Error('Invalid start date format. Please use YYYY-MM-DD format.');
                      }
                      if (endDate && !moment(endDate, 'YYYY-MM-DD', true).isValid()) {
                        throw new Error('Invalid end date format. Please use YYYY-MM-DD format.');
                      }
                      await downloadJournalAsTextFile(user.uid, startDate, endDate);
                    } else {
                      await downloadJournalAsTextFile(user.uid);
                    }
                    setModalVisible(false);
                  } catch (error: any) {
                    Alert.alert('Download Failed', error.message || 'Failed to download journal data.');
                  } finally {
                    setDownloadLoading(false);
                  }
                }}
                disabled={shareLoading || downloadLoading}
              >
                {downloadLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="file-download" size={20} color="#fff" />
                    <Text style={styles.exportActionButtonText}>Download as .txt</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.helpText}>
              The exported file will be saved as a text file and shared using your device's sharing options.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  exportButton: {
    ...Theme.ComponentStyles.buttonPrimary,
    backgroundColor: Theme.Colors.primary,
    marginVertical: Theme.Spacing.sm,
  },
  exportButtonText: {
    ...Theme.Typography.buttonMedium,
    marginLeft: Theme.Spacing.sm,
  },
  modalOverlay: {
    ...Theme.ComponentStyles.modalOverlay,
  },
  modalContent: {
    ...Theme.ComponentStyles.modalContent,
    maxHeight: '80%',
  },
  modalHeader: {
    ...Theme.ComponentStyles.modalHeader,
  },
  modalTitle: {
    ...Theme.Typography.h3,
    marginBottom: 0,
  },
  exportOptions: {
    marginBottom: Theme.Spacing.md,
  },
  optionButton: {
    paddingVertical: Theme.Spacing.sm,
    paddingHorizontal: Theme.Spacing.md,
    borderRadius: Theme.Layout.radiusMd,
    marginBottom: Theme.Spacing.sm,
    backgroundColor: Theme.Colors.surfaceHover,
  },
  selectedOption: {
    backgroundColor: Theme.Colors.primaryLight + '20', // 20% opacity
    borderColor: Theme.Colors.primary,
    borderWidth: 1,
  },
  optionText: {
    ...Theme.Typography.body,
    fontWeight: '500',
  },
  dateInputs: {
    marginBottom: Theme.Spacing.md,
  },
  inputGroup: {
    ...Theme.ComponentStyles.formGroup,
  },
  inputLabel: {
    ...Theme.ComponentStyles.formLabel,
  },
  input: {
    ...Theme.ComponentStyles.input,
  },
  exportActionButton: {
    ...Theme.ComponentStyles.buttonPrimary,
    marginBottom: Theme.Spacing.md,
  },
  exportActionButtonText: {
    ...Theme.Typography.buttonMedium,
    marginLeft: Theme.Spacing.sm,
  },
  helpText: {
    ...Theme.Typography.caption,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.Spacing.sm,
    paddingHorizontal: Theme.Spacing.md,
  },
  menuItemText: {
    ...Theme.Typography.body,
    marginLeft: Theme.Spacing.sm,
  },
  exportButtonsContainer: {
    flexDirection: 'column',
    gap: Theme.Spacing.sm,
    marginBottom: Theme.Spacing.md,
  },
  downloadButton: {
    backgroundColor: Theme.Colors.success,
  },
});

export default JournalExportButton;
