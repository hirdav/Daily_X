import { StyleSheet, TextStyle, ViewStyle, Dimensions } from 'react-native';

// Color palette
export const Colors = {
  // Primary colors
  primary: '#6B46C1', // Main brand color (purple)
  primaryLight: '#9F7AEA', // Lighter shade of primary
  primaryDark: '#553C9A', // Darker shade of primary
  
  // Secondary colors
  secondary: '#48BB78', // Secondary color (green)
  secondaryLight: '#68D391', // Lighter shade of secondary
  secondaryDark: '#38A169', // Darker shade of secondary
  
  // Accent colors
  accent: '#F59E0B', // Accent color (amber)
  accentLight: '#FBBF24', // Lighter shade of accent
  accentDark: '#D97706', // Darker shade of accent
  
  // Semantic colors
  success: '#10B981', // Success color (green)
  warning: '#F59E0B', // Warning color (amber)
  error: '#EF4444',   // Error/danger color (red)
  info: '#3B82F6',    // Info color (blue)
  
  // Neutral colors
  text: '#1F2937',       // Primary text
  textSecondary: '#6B7280', // Secondary text
  textLight: '#FFFFFF',   // Light text (for dark backgrounds)
  
  // Background colors
  background: '#FFFFFF',    // Main background
  surface: '#F9FAFB',       // Surface background (cards, etc.)
  surfaceHover: '#F3F4F6',  // Surface hover state
  
  // Border colors
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  
  // Other utility colors
  disabled: '#D1D5DB',
  placeholder: '#9CA3AF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// Spacing scale
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Typography
export const Typography = StyleSheet.create({
  // Headings
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  
  // Body text
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.text,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.text,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text,
    lineHeight: 20,
  },
  
  // Captions and labels
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xxs,
  },
  
  // Button text
  buttonLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textLight,
    textAlign: 'center',
  },
  buttonMedium: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textLight,
    textAlign: 'center',
  },
  buttonSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textLight,
    textAlign: 'center',
  },
});

// Layout constants
export const Layout = {
  // Screen dimensions
  windowWidth: Dimensions.get('window').width,
  windowHeight: Dimensions.get('window').height,
  
  // Standard measurements
  headerHeight: 60,
  footerHeight: 56,
  tabBarHeight: 56,
  sidebarWidth: 280,
  
  // Border radius
  radiusXs: 4,
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusFull: 9999,
};

// Shadows
export const Shadows = {
  small: {
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  large: {
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Common component styles
export const ComponentStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  // Header styles
  header: {
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadows.small,
  },
  headerTitle: {
    ...Typography.h3,
    marginBottom: 0,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Card styles
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radiusMd,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.small,
  },
  cardElevated: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radiusMd,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  
  // Button styles
  buttonPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.radiusMd,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  buttonSecondary: {
    backgroundColor: Colors.secondary,
    borderRadius: Layout.radiusMd,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderRadius: Layout.radiusMd,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  buttonText: {
    ...Typography.buttonMedium,
  },
  buttonTextOutline: {
    ...Typography.buttonMedium,
    color: Colors.primary,
  },
  
  // Input styles
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Layout.radiusMd,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
    minHeight: 48,
  },
  inputFocused: {
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Layout.radiusMd,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
    minHeight: 48,
  },
  
  // List styles
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: Layout.radiusMd,
    padding: Spacing.md,
    width: '90%',
    maxWidth: 400,
    ...Shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  
  // Form styles
  formGroup: {
    marginBottom: Spacing.md,
  },
  formLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  formError: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  
  // Utility styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

// Export all styles in a single object for convenience
export const Theme = {
  Colors,
  Spacing,
  Typography,
  Layout,
  Shadows,
  ComponentStyles,
};

export default Theme;
