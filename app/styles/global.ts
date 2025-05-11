import { StyleSheet, TextStyle, ViewStyle, Dimensions } from 'react-native';

export const Colors = {
  primary: '#6B46C1', // Primary purple
  primaryDark: '#553C9A',
  secondary: '#48BB78', // XP green
  secondaryDark: '#38A169',
  background: '#FFFFFF', // Main content background
  surface: '#F5F5F5', // Sidebar background
  card: '#FFFFFF', // Card background
  cardBackground: '#FFFFFF', // Card background for analytics components
  error: '#b00020',
  success: '#48BB78',
  warning: '#F59E0B', // Warning/alert color
  muted: '#718096',
  border: '#E2E8F0',
  text: '#1A202C', // Text black
  textLight: '#ffffff',
  textSecondary: '#718096', // Secondary text color
  white: '#FFFFFF', // Pure white
  inactive: '#9CA3AF', // Inactive color
  accent: '#FF9800', // Accent color for recurring tasks
};

export const Spacing = {
  tiny: 4,
  small: 8,
  medium: 16,
  large: 24,
  xlarge: 32,
  xxlarge: 48,
};

// Define fontSizes separately to avoid TypeScript errors
export const fontSizes = {
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
};

export const Typography: { [key: string]: TextStyle } = {
  heading: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
  },
  subheading: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.muted,
  },
  sidebarText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
};

export const Layout = {
  sidebarWidth: 200,
  headerHeight: 60,
};

export const GlobalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainContent: {
    flex: 1,
    marginLeft: Layout.sidebarWidth,
    backgroundColor: Colors.background,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: Layout.sidebarWidth,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: Spacing.large,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.medium,
    marginBottom: Spacing.small,
  },
  sidebarItemActive: {
    backgroundColor: Colors.background,
  },
  sidebarIcon: {
    marginRight: Spacing.medium,
    width: 20,
    height: 20,
  },
  header: {
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.medium,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.medium,
    marginBottom: Spacing.medium,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: Spacing.medium,
    alignItems: 'center',
    marginBottom: Spacing.medium,
  },
  buttonText: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.medium,
    fontSize: 16,
    color: Colors.text,
  },
  xpBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingHorizontal: Spacing.small,
    paddingVertical: Spacing.tiny,
    marginLeft: Spacing.small,
  },
  xpText: {
    color: Colors.textLight,
    fontSize: 12,
    fontWeight: '500',
  },
});



