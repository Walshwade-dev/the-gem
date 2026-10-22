// ============================================================================
// The Gem: Visual Theme & Styling Tokens
// Merchant Brand: Vibrant Turquoise Blue with High-Contrast Mobile-First Layout
// ============================================================================

export const THEME = {
  colors: {
    // Merchant Brand Color: Vibrant Turquoise Blue
    primary: '#0891B2',       // Vibrant Turquoise Blue (Cyan 600)
    primaryLight: '#06B6D4',  // Electric Turquoise (Cyan 500)
    primaryDark: '#164E63',   // Deep Turquoise Teal (Cyan 900)
    primarySoft: '#ECFEFF',   // Ice Turquoise Surface Tint (Cyan 50)
    primaryBorder: '#A5F3FC', // Accent Turquoise Border (Cyan 200)

    // Secondary Accent: Golden Amber for Produce & Grades
    secondary: '#D97706',     // Dried Onion Amber
    secondaryLight: '#F59E0B',// Warm Harvest Gold
    secondarySoft: '#FEF3C7', // Soft Amber Background

    // Kenyan Financial Emerald (M-Pesa & Positive Balances)
    emerald: '#059669',       // M-Pesa Green
    emeraldDark: '#064E3B',
    emeraldSoft: '#D1FAE5',

    // Status & Alert Indicators
    danger: '#DC2626',        // Shortages, Deficits, Lockdown
    dangerSoft: '#FEE2E2',
    warning: '#D97706',       // Pending Credit, Approaching 4-day max
    warningSoft: '#FEF3C7',
    info: '#0284C7',          // Sky Info Blue
    infoSoft: '#E0F2FE',

    // High-Contrast Daylight Palette (Optimized for bright outdoor market conditions)
    background: '#F0FDFA',    // Ultra-soft mint/turquoise-tinted slate background
    surface: '#FFFFFF',       // Pure white cards
    surfaceElevated: '#FFFFFF',
    border: '#E2E8F0',
    borderFocus: '#0891B2',

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
      xs: 11,
      sm: 13,
      base: 15,
      lg: 17,
      xl: 19,
      '2xl': 22,
      '3xl': 28,
      '4xl': 34,
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
    xl: 18,
    full: 9999,
  },

  // Mobile Touch Ergonomics
  touchTarget: {
    minHeight: 48,
    largeButtonHeight: 54,
  }
};
