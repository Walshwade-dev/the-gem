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

    // Badges & Tag Highlights (From Reference Sheet)
    tags: {
      newStock: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
      discounted: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
      mediumSize: { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' },
      smallSize: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
      largeSize: { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
      pending: { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
      verified: { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' },
    },

    // High-Contrast Daylight Palette (Optimized for bright outdoor market conditions)
    background: '#F0FDFA',    // Ultra-soft mint/turquoise-tinted slate background
    surface: '#FFFFFF',       // Pure white cards
    surfaceElevated: '#FFFFFF',
    border: '#E2E8F0',
    borderFocus: '#0891B2',

    // Vanta Black / Omarchy Dark Palette
    vanta: {
      background: '#000000',      // Pure Vanta Black OLED
      surface: '#0A0A0A',         // High-depth charcoal surface
      surfaceElevated: '#121212', // Slightly elevated container
      surfaceCard: '#0F0F11',     // Card surface
      border: '#1F1F23',          // Micro-border
      borderActive: '#27272A',    // Active border
      borderGlow: '#06B6D4',      // Neon cyan border
      textPrimary: '#FFFFFF',     // Crisp white
      textSecondary: '#A1A1AA',   // Zinc 400
      textMuted: '#52525B',       // Zinc 600
      buttonBg: '#141416',        // Vanta button background
      buttonBorder: '#27272A',    // Vanta button border
      accentCyan: '#22D3EE',      // Cyan glow
      accentEmerald: '#10B981',   // Emerald glow
    },

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
    // Exact Design System Scale from Reference Specification
    display: {
      fontSize: 48, // Range 44-56px
      lineHeight: 48, // 1.0
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    heading: {
      fontSize: 30, // Range 28-32px
      lineHeight: 36, // 1.2
      fontWeight: '700' as const,
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 16,
      lineHeight: 24, // 1.5
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 14,
      lineHeight: 20, // ~1.4
      fontWeight: '500' as const,
    },
    button: {
      fontSize: 17.5, // Range 17-18px
      lineHeight: 21, // ~1.2
      fontWeight: '600' as const,
      letterSpacing: 0.3,
    },

    // Numeric scales for utility lookups
    sizes: {
      xs: 11,
      sm: 13,
      base: 15,
      body: 16,
      lg: 17.5,
      xl: 19,
      '2xl': 22,
      '3xl': 30,
      '4xl': 48,
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

  // Corner Radius Scale from Reference Sheet (4px, 8px, 12px, 16px, 24px, pill)
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  // Stroke Thickness from Reference Sheet (1px fin, 2px standard, 4px épais)
  strokeWidth: {
    thin: 1,
    standard: 2,
    thick: 4,
  },

  // Elevation Levels from Reference Sheet (Base, Surélevé, Encastré, Foncé)
  elevation: {
    base: {
      borderWidth: 1,
      borderColor: '#E2E8F0',
      shadowColor: 'transparent',
      elevation: 0,
    },
    sureleve: {
      shadowColor: '#0891B2',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
      borderWidth: 1,
      borderColor: '#CCFBF1',
    },
    encastre: {
      borderWidth: 1.5,
      borderColor: '#A5F3FC',
      backgroundColor: '#ECFEFF',
    },
    fonce: {
      backgroundColor: '#0F172A',
      borderColor: '#1E293B',
      borderWidth: 1,
    },
  },

  // Mobile Touch Ergonomics
  touchTarget: {
    minHeight: 48,
    largeButtonHeight: 54,
  }
};
