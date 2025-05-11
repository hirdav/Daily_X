import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store/types';
import { setNetworkStatus, syncPendingOperations } from '../store/slices/networkSlice';
import { TypedUseSelectorHook, useSelector } from 'react-redux';
import { RootState } from '../store/types';

const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
import { Colors, Typography } from '../styles/global';

const NetworkMonitor: React.FC = () => {
  const netInfo = useNetInfo();
  const dispatch = useDispatch<AppDispatch>();
  const pendingOperations = useTypedSelector((state) => state.network.pendingOperations);
  const isConnected = useTypedSelector((state) => state.network.isConnected);

  // Update network status when connectivity changes
  useEffect(() => {
    if (netInfo.isConnected !== null) {
      dispatch(setNetworkStatus(!!netInfo.isConnected));
    }
  }, [netInfo.isConnected, dispatch]);

  // Attempt to sync pending operations when connection is restored
  useEffect(() => {
    if (isConnected && pendingOperations.length > 0) {
      dispatch(syncPendingOperations());
    }
  }, [isConnected, pendingOperations.length, dispatch]);

  // Always return null to disable the offline banner UI
  return null;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.error,
    padding: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  text: {
    color: 'white',
    textAlign: 'center',
    ...Typography.body,
  },
});

export default NetworkMonitor;
