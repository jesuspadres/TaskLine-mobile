// Theme constants matching TaskLine web branding
// Website uses HSL: primary 221/83%/25% (light), 221/83%/53% (dark)
// Accent: HSL 38/92%/50% (gold/amber)

export const Colors = {
  light: {
    // Primary — deep navy in light mode (matches website)
    primary: '#0B3D91',
    primaryLight: '#2563eb',
    primaryDark: '#082B66',

    // Accent — gold/amber (matches website accent)
    accent: '#F5A623',
    accentLight: '#FEF3C7',

    // Background
    background: '#f9fafb',
    surface: '#ffffff',
    surfaceSecondary: '#f3f4f6',

    // Text
    text: '#111827',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',

    // Border
    border: '#e5e7eb',
    borderLight: '#f3f4f6',

    // Status colors
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',

    // Priority colors
    priorityLow: '#10b981',
    priorityMedium: '#f59e0b',
    priorityHigh: '#ef4444',

    // Status badges
    statusNew: '#8b5cf6',
    statusNewLight: '#f3e8ff',
    statusReviewing: '#f59e0b',
    statusConverted: '#10b981',
    statusDeclined: '#6b7280',
    statusActive: '#3b82f6',
    statusCompleted: '#10b981',
    statusPending: '#f59e0b',
    statusApproved: '#10b981',
    statusRejected: '#ef4444',
    statusDraft: '#6b7280',

    // Glassmorphism effects
    cardShadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    // Primary — brighter blue in dark mode
    primary: '#3b82f6',
    primaryLight: '#60a5fa',
    primaryDark: '#2563eb',

    // Accent
    accent: '#F5A623',
    accentLight: '#78350f',

    // Background
    background: '#0f172a',
    surface: '#1e293b',
    surfaceSecondary: '#334155',

    // Text
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',

    // Border
    border: '#334155',
    borderLight: '#475569',

    // Status colors
    success: '#34d399',
    successLight: '#064e3b',
    warning: '#fbbf24',
    warningLight: '#78350f',
    error: '#f87171',
    errorLight: '#7f1d1d',
    info: '#60a5fa',
    infoLight: '#1e3a5f',

    // Priority colors
    priorityLow: '#34d399',
    priorityMedium: '#fbbf24',
    priorityHigh: '#f87171',

    // Status badges
    statusNew: '#a78bfa',
    statusNewLight: '#2e1065',
    statusReviewing: '#fbbf24',
    statusConverted: '#34d399',
    statusDeclined: '#94a3b8',
    statusActive: '#60a5fa',
    statusCompleted: '#34d399',
    statusPending: '#fbbf24',
    statusApproved: '#34d399',
    statusRejected: '#f87171',
    statusDraft: '#94a3b8',

    // Glassmorphism effects
    cardShadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

// Type for color scheme
export type ThemeColors = typeof Colors.light;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};
