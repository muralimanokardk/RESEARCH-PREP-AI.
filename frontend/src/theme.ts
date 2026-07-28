/**
 * Design tokens for Research Prep AI
 * Aurora Glass / Pastel personality
 */
export const colors = {
  surface: '#F4F7FC',
  onSurface: '#111827',
  surfaceSecondary: '#FFFFFF',
  onSurfaceSecondary: '#6B7280',
  surfaceTertiary: '#E5EDF8',
  onSurfaceTertiary: '#374151',
  brand: '#7C3AED',
  brandLight: '#E5DBFF',
  brandSecondary: '#06B6D4',
  brandSecondaryLight: '#D0F0FD',
  brandTertiary: '#10B981',
  brandTertiaryLight: '#E2F9EE',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#06B6D4',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  divider: '#F3F4F6',
  glass: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(255,255,255,0.4)',
  white: '#FFFFFF',
  slate: '#6B7280',
  ink: '#111827',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 24,
  pill: 999,
};

export const font = {
  family: 'Inter',
  sizes: { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
  },
};

export const shadow = {
  soft: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  card: {
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
};
