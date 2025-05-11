import { LightTheme, DarkTheme } from '../contexts/ThemeContext';

/**
 * Gets the appropriate color value based on the current theme mode
 * @param isDarkMode Whether dark mode is enabled
 * @param colorKey The color key to get
 * @returns The color value for the current theme
 */
export const getThemeColor = (isDarkMode: boolean, colorKey: keyof typeof LightTheme): string => {
  return isDarkMode ? DarkTheme[colorKey] : LightTheme[colorKey];
};

/**
 * Creates a dynamic style object based on the current theme
 * @param isDarkMode Whether dark mode is enabled
 * @returns Object with color values for the current theme
 */
export const getDynamicColors = (isDarkMode: boolean) => {
  return {
    primary: getThemeColor(isDarkMode, 'primary'),
    secondary: getThemeColor(isDarkMode, 'secondary'),
    background: getThemeColor(isDarkMode, 'background'),
    surface: getThemeColor(isDarkMode, 'surface'),
    text: getThemeColor(isDarkMode, 'text'),
    textLight: getThemeColor(isDarkMode, 'textLight'),
    muted: getThemeColor(isDarkMode, 'muted'),
    border: getThemeColor(isDarkMode, 'border'),
    error: getThemeColor(isDarkMode, 'error'),
    success: getThemeColor(isDarkMode, 'success'),
    warning: getThemeColor(isDarkMode, 'warning'),
    info: getThemeColor(isDarkMode, 'info'),
    cardBackground: isDarkMode ? DarkTheme.surface : LightTheme.surface,
    textSecondary: isDarkMode ? DarkTheme.muted : LightTheme.muted,
  };
};
