// ============================================================================
// The Gem: Visual Theme & Styling Tokens
// High-Contrast Outdoor Readability for Wakulima Market Trading
// ============================================================================

export const THEME = {
  colors: {
    // Brand Jewel Colors (Deep Red Onion Skin & Gemstone Ruby)
    primary: '#881337',       // Deep Onion Ruby
    primaryLight: '#9F1239',  // Vibrant Onion Crimson
    primaryDark: '#4C0519',   // Deepest Burgundy
    primarySoft: '#FFE4E6',   // Soft Rose Tint for Cards

    // Produce Gold & Papery Shallot Amber
    secondary: '#D97706',     // Dried Onion Amber
    secondaryLight: '#F59E0B',// Warm Harvest Gold
    secondarySoft: '#FEF3C7', // Soft Amber Background

    // Kenyan Financial Emerald (M-Pesa & Cash Balance)
    emerald: '#059669',       // M-Pesa Green
    emeraldDark: '#064E3B',
    emeraldSoft: '#D1FAE5',

    // Status & Alert Indicators
    danger: '#DC2626',        // Shortages, Deficits, Lockdown
    dangerSoft: '#FEE2E2',
    warning: '#D97706',       // Pending Credit, Approaching 4-day max
    warningSoft: '#FEF3C7',
    info: '#2563EB',
    infoSoft: '#DBEAFE',

    // High-Contrast Daylight Palette (Optimized for bright outdoor market conditions)
    background: '#F8FAFC',    // Off-white slate
    surface: '#FFFFFF',       // Pure white cards
    surfaceElevated: '#FFFFFF',
    border: '#E2E8F0',
    borderFocus: '#881337',

    // Text Levels
    textPrimary: '#0F172A',   // Slate 900 (High contrast dark)
    textSecondary: '#475569', // Slate 600
    textMuted: '#94A3B8',     // Slate 400
    textInverse: '#FFFFFF',
    
    // Lockdown Emergency Mode
    lockdownBg: '#450A0A',
    lockdownBorder: '#EF4444',
  },

  typography: {
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
    }
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
  },

  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },

  // Touch Target Accessibility (Ensures wet/dusty thumbs can tap accurately)
  touchTarget: {
    minHeight: 52,
    largeButtonHeight: 60,
  }
};
