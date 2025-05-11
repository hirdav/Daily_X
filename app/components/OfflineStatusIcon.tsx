import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TypedUseSelectorHook, useSelector } from 'react-redux';
import { RootState } from '../store/types';

import { Colors } from '../styles/global';

/**
 * A subtle offline icon that appears when the app is offline or in offline mode.
 * Designed to be placed beside the sidebar/drawer button.
 */

const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;

const OfflineStatusIcon: React.FC = () => {
  const isConnected = useTypedSelector((state: RootState) => state.network.isConnected);
  const isOfflineMode = useTypedSelector((state: RootState) => state.network.isOfflineMode);

  // Show icon only if offline or in explicit offline mode
  if (isConnected && !isOfflineMode) return null;

  return (
    <View style={styles.iconContainer}>
      <MaterialIcons name="cloud-off" size={22} color={Colors.muted} />
    </View>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OfflineStatusIcon;
