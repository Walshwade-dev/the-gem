# Feature Prompt: Design System & Visual Architecture from Reference

> Structured following [prompts/template.md](file:///home/wadeace/Projects/onion%20sales/prompts/template.md). This prompt establishes the unified visual design system, typography scale, component library, and liquid glass navigation for "The Gem: Onion Sales Tracker", faithfully derived from the reference specifications (`~/Pictures/Screenshots/reference.png`).

---

## 1. Goal
Users can navigate a visually cohesive, high-contrast mobile interface with a floating liquid glass bottom bar, standardized typography scales, and polished component styling for onion produce listings, market policies, debtor profiles, and transactional status alerts. The entire interface maintains flawless visual hierarchy and responsiveness across both Daylight outdoor market operations and Vanta OLED dark mode.

---

## 2. Decisions
- Typography scale strictly adheres to reference specs: Display Geometric sans bold 56–44 (line-height 1.0), Heading Geometric sans bold 28–32 (line-height 1.2), Body Geometric sans regular 16 (line-height 1.5), Caption Geometric sans medium 14, and Buttons Geometric sans medium 17–18.
- The color palette preserves existing brand continuity: Turquoise Blue (`#0891B2`), Harvest Amber (`#D97706`), M-Pesa Emerald (`#059669`), Daylight Background (`#F0FDFA`), and Vanta Black (`#000000`).
- Navigation transitions to a floating, translucent liquid glass bottom bar with frosted blur, rounded pill indicator, and real-time pending notification badges.
- Corner radii follow the reference token scale: `sm: 4px`, `md: 8px`, `lg: 12px`, `xl: 16px`, `card: 24px`, and `full: 9999px`.
- Stroke widths for cards, inputs, and chips follow reference borders: `hairline: 1px`, `normal: 1.5px`, and `thick: 2px`.
- Produce listing cards include packaging badges and tags: `New Stock`, `Discounted`, `Large Size`, `Medium Size`, and `Small Size` with instant wholesale price calculation per kilogram.
- Market policies are visually organized into dedicated policy cards covering NCC Cess, 4-Day Supervised Credit, Produce Sorting, and 14:00 COB reconciliation.
- User profile sections feature personal credentials, assigned truck batch origin, debtor overview metrics, and active store payment methods (M-Pesa Till, Cash Drawer, and 4-Day Credit).
- Transactional feedback and OTP alerts use standardized floating toast banners with distinct color states for Success, Warning, Error, and Info.

---

## 3. Out of Scope
- Custom OTF/TTF proprietary font bundling (native geometric sans-serif system fallbacks are used to guarantee universal zero-lag rendering).
- Video adverts or camera streaming inside listing cards (static cured produce imagery and WhatsApp advert text sharing are supported).
- Biometric biometric hardware enrollment outside Expo standard LocalAuthentication.
- Automatic county payment gateway API integration (manual receipt code capture and reconciliation remain the standard).

---

## 4. Steps

### Step 1: Design Tokens & Typography Scale Definition
- **Files & Context Needed**: [`src/constants/theme.ts`](file:///home/wadeace/Projects/onion%20sales/src/constants/theme.ts), [`tailwind.config.js`](file:///home/wadeace/Projects/onion%20sales/tailwind.config.js).
- **Prompt**: Configure the complete typography scale (`display`, `heading`, `body`, `caption`, `button`), stroke widths, corner radii, elevation shadows, and advert tag color palettes (`newStock`, `discounted`, `mediumSize`, `smallSize`, `largeSize`) matching the reference image.
- **Expected Working State**: All tokens are exported from `THEME` and registered in `tailwind.config.js` utility classes, compiling cleanly with zero TypeScript errors.

### Step 2: Liquid Glass Floating Bottom Navigation Bar
- **Files & Context Needed**: [`src/components/ui/LiquidGlassBottomBar.tsx`](file:///home/wadeace/Projects/onion%20sales/src/components/ui/LiquidGlassBottomBar.tsx), [`App.tsx`](file:///home/wadeace/Projects/onion%20sales/App.tsx).
- **Prompt**: Implement a floating bottom dock mimicking liquid glass with frosted translucent background, active tab pill indicator, haptic-friendly icons (`Sales`, `Produce`, `Ledger`, `Policies`, `Profile`), and notification badge counters for pending credit approvals.
- **Expected Working State**: The bottom bar floats above all tab views with responsive safe-area padding and seamless tab switching.

### Step 3: Produce Listing Cards & Advert Broadcast Component
- **Files & Context Needed**: [`src/components/ui/ProduceListingCard.tsx`](file:///home/wadeace/Projects/onion%20sales/src/components/ui/ProduceListingCard.tsx), [`src/components/ui/FilterChips.tsx`](file:///home/wadeace/Projects/onion%20sales/src/components/ui/FilterChips.tsx).
- **Prompt**: Build onion packaging listing cards displaying cured produce imagery, grade badges, advert tags (`New Stock`, `Discounted`, `Large Size`, `Medium Size`, `Small Size`), price per sack and auto-computed price per kg, a "Log Sale" quick action, and a "Share Advert" trigger for WhatsApp broadcasts.
- **Expected Working State**: Traders can filter produce packages via filter chips and trigger sales logging or marketing adverts directly from the catalog.

### Step 4: Market Policy Cards & User Profile Section
- **Files & Context Needed**: [`src/components/ui/MarketPolicyCard.tsx`](file:///home/wadeace/Projects/onion%20sales/src/components/ui/MarketPolicyCard.tsx), [`src/components/ui/UserProfileSection.tsx`](file:///home/wadeace/Projects/onion%20sales/src/components/ui/UserProfileSection.tsx).
- **Prompt**: Implement market policy cards detailing County Cess, 4-Day Credit Governance, Grade Sorting Standards, and 14:00 COB reconciliation. Build the user profile section displaying merchant/seller identity, assigned truck batch, debtor statistics, and active payment channels.
- **Expected Working State**: Policy rules and store profile information render crisply with high contrast in both Daylight and Dark modes.

### Step 5: Status Alert Banners & Interactive Feedback Toasts
- **Files & Context Needed**: [`src/components/ui/StatusAlertToast.tsx`](file:///home/wadeace/Projects/onion%20sales/src/components/ui/StatusAlertToast.tsx), [`App.tsx`](file:///home/wadeace/Projects/onion%20sales/App.tsx).
- **Prompt**: Build an alert toast system providing visual confirmation for SMS OTP dispatch, successful sale recording, credit approval updates, and payment receipt verifications.
- **Expected Working State**: Toasts smoothly slide in at the top of the mobile screen and auto-dismiss after 3.5 seconds.

---

## 5. Verification
- **Flow Ran**:
  1. Launch the app on Expo dev server and verify the login screen with the updated Turquoise logo and fixed-width card container.
  2. Log in as Merchant or Sales Agent and observe the floating liquid glass bottom bar.
  3. Navigate through all 5 tabs: **Sales Tracker**, **Produce & Adverts**, **Credit Ledger**, **Market Policies**, and **Store Profile**.
  4. Toggle produce filter chips (`All`, `Grade 1`, `Grade 2`, `New Arrivals`, `Discounted`).
  5. Test "Log Sale" and "Share Advert" buttons on produce listing cards.
  6. Inspect debtor statistics and payment methods in the Profile tab.
- **Cases to Try**:
  - Switch between Daylight mode and Vanta Dark mode across all screens.
  - Verify that no visual layout jumping occurs when switching roles or tabs.
  - Verify that pending credit approval badges update the count pill on the bottom navigation bar.
- **Checks to Pass**:
  - `npx tsc --noEmit` exits with code 0.
  - No layout overflow or clipping across any card, input, or bottom dock.
  - Text contrast complies with daylight readability standards (min 4.5:1 ratio).
- **End-to-End Feature Check**: The complete visual system renders faithfully to the reference design with fluid navigation, robust component styling, and zero compile errors.

---

## 6. AGENTS.md Update
- **Target Section**: Design System & Reference Visual Architecture
- **Persistent Rules**:
  - Use typography tokens from `THEME.typography` (`display`, `heading`, `body`, `caption`, `button`).
  - Maintain the floating liquid glass bottom navigation pattern across mobile views.
  - Produce listing cards must always display computed price per kg alongside sack prices.
  - All debtor overview calculations must read from `CustomerCredit.totalOutstandingCredit`.
  - Batch origin references must access `batch.origin.regionName` rather than treating origin as a plain string.
- **Notes**: none
