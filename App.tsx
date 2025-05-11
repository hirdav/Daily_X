import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { setupAuthPersistence } from './app/utils/authPersistence';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './app/store';
import { useNetInfo } from '@react-native-community/netinfo';
import { useDispatch } from 'react-redux';
import { setNetworkStatus, syncPendingOperations } from './app/store/slices/networkSlice';
import { initializeNotifications } from './app/services/NotificationService';

import Dashboard from './app/screens/Dashboard';
import ManageTasks from './app/screens/ManageTasks';
import Journal from './app/screens/Journal';
// Analytics screen removed as requested
import History from './app/screens/History';
import Profile from './app/screens/Profile';
import Settings from './app/screens/Settings';
import Login from './app/screens/Login';
import SignUp from './app/screens/SignUp';
import Home from './app/screens/Home';
import Sidebar from './app/components/Sidebar';
import NetworkMonitor from './app/components/NetworkMonitor';
import TaskResetManager from './app/components/TaskResetManager';
import { ThemeProvider } from './app/contexts/ThemeContext';
// Using statsService instead of context provider

export type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  Main: undefined;
};

export type DrawerParamList = {
  Dashboard: undefined;
  ManageTasks: { taskId?: string } | undefined;
  Journal: undefined;
  // Analytics removed as requested
  History: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <Sidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="Dashboard" component={Dashboard} />
      <Drawer.Screen name="ManageTasks" component={ManageTasks} />
      <Drawer.Screen name="Journal" component={Journal} />
      {/* Analytics screen removed as requested */}
      <Drawer.Screen name="History" component={History} />
      <Drawer.Screen name="Profile" component={Profile} />
      <Drawer.Screen name="Settings" component={Settings} />
    </Drawer.Navigator>
  );
};

// Network monitoring component that uses Redux
const NetworkAwareApp = () => {
  const netInfo = useNetInfo();
  const dispatch = useDispatch();
  
  // Initialize auth persistence and notifications when app starts
  useEffect(() => {
    setupAuthPersistence();
    initializeNotifications();
  }, []);

  useEffect(() => {
    // Update network status in Redux when it changes
    if (netInfo.isConnected !== null) {
      dispatch(setNetworkStatus(netInfo.isConnected));

      // If we're back online, try to sync any pending operations
      if (netInfo.isConnected) {
        // @ts-ignore - This is a thunk action that returns a function
        dispatch(syncPendingOperations());
      }
    }
  }, [netInfo.isConnected, dispatch]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="SignUp" component={SignUp} />
            <Stack.Screen name="Main" component={DrawerNavigator} />
          </Stack.Navigator>
          <NetworkMonitor />
          <TaskResetManager />
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

// Main App component wrapped with Redux Provider
const App = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <NetworkAwareApp />
      </PersistGate>
    </Provider>
  );
};

export default App;
