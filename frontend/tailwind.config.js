/** @type {import('tailwindcss').Config} */
module.exports = {
  // Paths to all component files that contain NativeWind classes
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Merchant Brand Color: Vibrant Turquoise Blue
        turquoise: {
          50: "#ECFEFF",  // Ice Turquoise Surface Tint
          100: "#CFFAFE",
          200: "#A5F3FC", // Accent Turquoise Border
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4", // Electric Turquoise
          600: "#0891B2", // Primary Vibrant Turquoise Blue
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63", // Deep Turquoise Teal
        },

        // Secondary Accent: Dried Onion Harvest Amber
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7", // Soft Amber Background
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24",
          500: "#F59E0B", // Warm Harvest Gold
          600: "#D97706", // Dried Onion Amber
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },

        // Kenyan Financial Emerald (M-Pesa & Positive Balances)
        emerald: {
          50: "#ECFDF5",
          100: "#D1FAE5", // Soft M-Pesa Green Tint
          200: "#A7F3D0",
          500: "#10B981",
          600: "#059669", // M-Pesa Primary Green
          700: "#047857",
          800: "#065F46",
          900: "#064E3B", // Deep Emerald
        },

        // High-Contrast Daylight Palette (Outdoor Market)
        daylight: {
          bg: "#F0FDFA",       // Soft mint/slate background
          surface: "#FFFFFF",  // Card surface
          border: "#E2E8F0",   // Border line
        },

        // Vanta Black / Omarchy Dark Palette (Warehouse / Evening)
        vanta: {
          bg: "#000000",       // Pure OLED black
          surface: "#0A0A0A",  // High-depth charcoal
          elevated: "#121212", // Elevated container
          card: "#0F0F11",     // Card surface
          border: "#1F1F23",   // Micro-border
          borderActive: "#27272A",
          button: "#141416",
        },

        // Status & Alerts
        danger: {
          DEFAULT: "#DC2626",
          soft: "#FEE2E2",
        },
        warning: {
          DEFAULT: "#D97706",
          soft: "#FEF3C7",
        },
        info: {
          DEFAULT: "#0284C7",
          soft: "#E0F2FE",
        },
      },

      fontSize: {
        // Geometric Sans Design Scale
        "display": ["48px", { lineHeight: "48px", fontWeight: "700" }],
        "heading": ["30px", { lineHeight: "36px", fontWeight: "700" }],
        "body": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "caption": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "btn": ["17.5px", { lineHeight: "21px", fontWeight: "600" }],

        // Utility sizes
        "xs": ["11px", { lineHeight: "14px" }],
        "sm": ["13px", { lineHeight: "17px" }],
        "base": ["15px", { lineHeight: "20px" }],
        "lg": ["17.5px", { lineHeight: "21px" }],
        "xl": ["19px", { lineHeight: "25px" }],
        "2xl": ["22px", { lineHeight: "28px" }],
        "3xl": ["30px", { lineHeight: "36px" }],
        "4xl": ["48px", { lineHeight: "48px" }],
      },

      borderWidth: {
        DEFAULT: "1px",
        "0": "0px",
        "1": "1px",
        "2": "2px",
        "4": "4px",
      },

      spacing: {
        "4.5": "18px",
        "13": "52px",
        "15": "60px",
      },

      borderRadius: {
        "xs": "4px",
        "sm": "8px",
        "md": "12px",
        "lg": "16px",
        "xl": "24px",
        "card": "16px",
        "pill": "9999px",
        "full": "9999px",
      },
    },
  },
  plugins: [],
};
