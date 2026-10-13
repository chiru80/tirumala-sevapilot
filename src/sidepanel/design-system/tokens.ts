/**
 * Tirumala SevaPilot — Design System Tokens (Phase 13)
 * Professional, calm, modern, and accessible design system tokens.
 * Focus: Premium, trustworthy, calm productivity tool (not an over-saffroned temple dashboard).
 */

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: 'Cinzel, Georgia, "Times New Roman", serif',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.8125rem',  // 13px
    base: '0.875rem',  // 14px
    md: '0.9375rem',  // 15px
    lg: '1rem',       // 16px
    xl: '1.125rem',   // 18px
    '2xl': '1.375rem',// 22px
    '3xl': '1.5rem',  // 24px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.2',
    snug: '1.35',
    normal: '1.5',
    relaxed: '1.65',
  },
} as const;

export const spacing = {
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  3.5: '0.875rem', // 14px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  8: '2rem',       // 32px
} as const;

export const radii = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.25rem',// 20px
  full: '9999px',
} as const;

export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
} as const;

export const colors = {
  brand: {
    primary: '#54258A',
    primaryHover: '#431D6E',
    accentGold: '#D4A72C',
    accentGoldLight: '#F3DB83',
  },
  surface: {
    light: '#FFFFFF',
    lightAlt: '#FAF8F5',
    dark: '#211526',
    darkAlt: '#2A1A31',
    darkCard: '#2E1E36',
  },
  status: {
    ready: {
      bg: '#ECFDF5',
      text: '#065F46',
      border: '#A7F3D0',
      dot: '#10B981',
      darkBg: 'rgba(16, 185, 129, 0.15)',
      darkText: '#6EE7B7',
      darkBorder: 'rgba(16, 185, 129, 0.35)',
    },
    working: {
      bg: '#EFF6FF',
      text: '#1E40AF',
      border: '#BFDBFE',
      dot: '#3B82F6',
      darkBg: 'rgba(59, 130, 246, 0.15)',
      darkText: '#93C5FD',
      darkBorder: 'rgba(59, 130, 246, 0.35)',
    },
    actionRequired: {
      bg: '#FFFBEB',
      text: '#92400E',
      border: '#FDE68A',
      dot: '#F59E0B',
      darkBg: 'rgba(245, 158, 11, 0.15)',
      darkText: '#FCD34D',
      darkBorder: 'rgba(245, 158, 11, 0.35)',
    },
    blocked: {
      bg: '#FEF2F2',
      text: '#991B1B',
      border: '#FECACA',
      dot: '#EF4444',
      darkBg: 'rgba(239, 68, 68, 0.15)',
      darkText: '#FCA5A5',
      darkBorder: 'rgba(239, 68, 68, 0.35)',
    },
    completed: {
      bg: '#F5F3FF',
      text: '#5B21B6',
      border: '#DDD6FE',
      dot: '#8B5CF6',
      darkBg: 'rgba(139, 92, 246, 0.15)',
      darkText: '#C4B5FD',
      darkBorder: 'rgba(139, 92, 246, 0.35)',
    },
  },
} as const;
