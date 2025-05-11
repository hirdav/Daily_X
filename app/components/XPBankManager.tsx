import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getXPBank, getXPBankRecords, modifyTaskXP, XPBankRecord, XP_CAP } from '../utils/firebaseService';

interface XPBankManagerProps {
  date?: Date; // Optional date, defaults to today
  onXPUpdated?: () => void; // Callback when XP is updated
}

const XPBankManager: React.FC<XPBankManagerProps> = ({ date = new Date(), onXPUpdated }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [xpBank, setXpBank] = useState<{ totalXP: number; availableXP: number } | null>(null);
  const [records, setRecords] = useState<XPBankRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<XPBankRecord | null>(null);
  const [newXpValue, setNewXpValue] = useState('');
  const [modifyModalVisible, setModifyModalVisible] = useState(false);

  // Load XP bank data
  const loadXPBankData = async () => {
    setLoading(true);
    try {
      // Load both data types in parallel for efficiency
      const [bankData, recordsData] = await Promise.all([
        getXPBank(date),
        getXPBankRecords(date)
      ]);
      
      // Update XP bank data
      if (bankData) {
        setXpBank({
          totalXP: bankData.totalXP,
          availableXP: bankData.availableXP
        });
      } else {
        setXpBank({
          totalXP: 0,
          availableXP: XP_CAP
        });
      }

      // Sort and filter records in one go to avoid multiple renders
      if (recordsData && recordsData.length > 0) {
        const filteredAndSorted = recordsData
          .filter(record => record.actionType === 'completed' || record.actionType === 'adjusted')
          .sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return b.timestamp.seconds - a.timestamp.seconds; // newest first
          });
        setRecords(filteredAndSorted);
      } else {
        setRecords([]);
      }
    } catch (error) {
      console.error('Error loading XP bank data:', error);
      Alert.alert('Error', 'Failed to load XP bank data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isModalVisible) {
      loadXPBankData();
    }
  }, [isModalVisible, date]);

  const handleModifyXP = (record: XPBankRecord) => {
    setSelectedTask(record);
    setNewXpValue(String(record.xpAmount > 0 ? record.xpAmount : record.originalXp || 0));
    setModifyModalVisible(true);
  };

  const handleSaveXP = async () => {
    if (!selectedTask) return;
    
    const xpValue = parseInt(newXpValue);
    if (isNaN(xpValue) || xpValue <= 0) {
      Alert.alert('Invalid XP', 'XP value must be a positive number');
      return;
    }

    setLoading(true);
    try {
      const result = await modifyTaskXP(selectedTask.taskId, xpValue);
      
      if (result.success) {
        Alert.alert('Success', 'Task XP has been updated');
        setModifyModalVisible(false);
        loadXPBankData();
        if (onXPUpdated) onXPUpdated();
      } else {
        Alert.alert('Error', result.message || 'Failed to update task XP');
      }
    } catch (error) {
      console.error('Error modifying task XP:', error);
      Alert.alert('Error', 'Failed to update task XP');
    } finally {
      setLoading(false);
    }
  };

  const renderXPBankRecord = ({ item }: { item: XPBankRecord }) => {
    // Only show completed or adjusted tasks that can be modified
    if (item.actionType !== 'completed' && item.actionType !== 'adjusted') {
      return null;
    }

    return (
      <View style={styles.recordItem}>
        <View style={styles.recordInfo}>
          <Text style={styles.taskTitle}>{item.taskTitle}</Text>
          <View style={styles.taskDetails}>
            <Text style={styles.xpValue}>
              {item.xpAmount} XP
              {item.originalXp && item.originalXp !== item.xpAmount && 
                <Text style={styles.originalXp}> (originally {item.originalXp} XP)</Text>
              }
            </Text>
            <Text style={styles.completedTime}>
              {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.modifyButton}
          onPress={() => handleModifyXP(item)}
        >
          <Text style={styles.modifyButtonText}>Modify</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View>
      {/* XP Bank Button */}
      <TouchableOpacity 
        style={styles.xpBankButton}
        onPress={() => setIsModalVisible(true)}
      >
        <Ionicons name="wallet-outline" size={24} color="#5e60ce" />
        <Text style={styles.xpBankButtonText}>XP Bank</Text>
      </TouchableOpacity>

      {/* XP Bank Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>XP Bank</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.xpSummary}>
              <Text style={styles.dateText}>{date.toDateString()}</Text>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Total XP:</Text>
                <Text style={styles.xpValue}>{xpBank?.totalXP || 0} / {XP_CAP}</Text>
              </View>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>Available XP:</Text>
                <Text style={styles.xpValue}>{xpBank?.availableXP || XP_CAP}</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${((xpBank?.totalXP || 0) / XP_CAP) * 100}%` }
                  ]} 
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Completed Tasks</Text>
            {loading ? (
              <Text style={styles.loadingText}>Loading...</Text>
            ) : (
              <View style={{flex: 1, minHeight: 200}}>
                <FlatList
                  data={records}
                  renderItem={renderXPBankRecord}
                  keyExtractor={(item) => item.id}
                  style={styles.recordsList}
                  ListEmptyComponent={<Text style={styles.emptyText}>No completed tasks found for this day</Text>}
                  initialNumToRender={10}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                  removeClippedSubviews={false}
                  scrollEnabled={true}
                  contentContainerStyle={{
                    flexGrow: 1,
                    paddingBottom: 20
                  }}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modify XP Modal */}
      <Modal
        visible={modifyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModifyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modifyModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modify Task XP</Text>
              <TouchableOpacity onPress={() => setModifyModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedTask && (
              <View style={styles.modifyForm}>
                <Text style={styles.taskTitle}>{selectedTask.taskTitle}</Text>
                
                <Text style={styles.inputLabel}>Current XP: {selectedTask.xpAmount}</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New XP Value:</Text>
                  <TextInput
                    style={styles.input}
                    value={newXpValue}
                    onChangeText={setNewXpValue}
                    keyboardType="number-pad"
                    placeholder="Enter new XP value"
                  />
                </View>

                <Text style={styles.xpLimitInfo}>
                  You have {xpBank?.availableXP || 0} XP available today
                  {selectedTask.xpAmount > 0 && ` (plus the current ${selectedTask.xpAmount} XP from this task)`}
                </Text>

                <TouchableOpacity 
                  style={[styles.saveButton, loading && styles.disabledButton]}
                  onPress={handleSaveXP}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  xpBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  xpBankButtonText: {
    marginLeft: 8,
    color: '#5e60ce',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modifyModalContent: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5e60ce',
  },
  xpSummary: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xpLabel: {
    fontSize: 14,
    color: '#555',
  },
  xpValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5e60ce',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  recordsList: {
    maxHeight: 300,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  recordInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  taskDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completedTime: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  originalXp: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  modifyButton: {
    backgroundColor: '#5e60ce',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  modifyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    color: '#888',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#888',
    fontStyle: 'italic',
  },
  modifyForm: {
    padding: 16,
  },
  inputContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  xpLimitInfo: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#5e60ce',
    padding: 12,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default XPBankManager;
