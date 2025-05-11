import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';

// Define theme colors
export const LightTheme = {
  primary: '#5e60ce',
  secondary: '#7400b8',
  background: '#f8f9fa',
  surface: '#ffffff',
  text: '#212529',
  textLight: '#ffffff',
  muted: '#6c757d',
  border: '#dee2e6',
  error: '#dc3545',
  success: '#28a745',
  warning: '#ffc107',
  info: '#17a2b8',
  cardBackground: '#ffffff',
  textSecondary: '#6c757d',
};

export const DarkTheme = {
  primary: '#6c63ff',
  secondary: '#9d4edd',
  background: '#121212',
  surface: '#1e1e1e',
  text: '#f8f9fa',
  textLight: '#ffffff',
  muted: '#adb5bd',
  border: '#343a40',
  error: '#f44336',
  success: '#4caf50',
  warning: '#ff9800',
  info: '#2196f3',
  cardBackground: '#2d2d2d',
  textSecondary: '#adb5bd',
};

// Sound effects
const soundEffects = {
  taskComplete: require('../assets/sounds/task-complete.mp3'),
  buttonPress: require('../assets/sounds/button-press.mp3'),
  notification: require('../assets/sounds/notification.mp3'),
};

// Define the theme type to include all color properties
type ThemeType = typeof LightTheme;

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  colors: ThemeType;
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (sound: keyof typeof soundEffects) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleDarkMode: () => {},
  colors: LightTheme,
  soundEnabled: true,
  toggleSound: () => {},
  playSound: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const darkMode = await AsyncStorage.getItem('darkMode');
        const sound = await AsyncStorage.getItem('soundEnabled');
        
        if (darkMode !== null) {
          setIsDarkMode(darkMode === 'true');
        }
        
        if (sound !== null) {
          setSoundEnabled(sound === 'true');
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading theme preferences:', error);
        setIsInitialized(true);
      }
    };
    
    loadPreferences();
  }, []);

  const toggleDarkMode = async () => {
    const newValue = !isDarkMode;
    setIsDarkMode(newValue);
    try {
      await AsyncStorage.setItem('darkMode', newValue.toString());
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  const toggleSound = async () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    try {
      await AsyncStorage.setItem('soundEnabled', newValue.toString());
    } catch (error) {
      console.error('Error saving sound preference:', error);
    }
  };

  const playSound = async (sound: keyof typeof soundEffects) => {
    if (!soundEnabled) return;
    
    try {
      const { sound: audioSound } = await Audio.Sound.createAsync(soundEffects[sound]);
      await audioSound.playAsync();
      
      // Unload sound when finished
      audioSound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          audioSound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const colors = isDarkMode ? DarkTheme : LightTheme;

  if (!isInitialized) {
    // You could return a loading screen here if needed
    return null;
  }

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        toggleDarkMode,
        colors,
        soundEnabled,
        toggleSound,
        playSound,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
