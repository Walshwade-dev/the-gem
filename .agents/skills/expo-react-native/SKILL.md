---
name: expo-react-native
description: >-
  Comprehensive guide and best practices for building mobile applications with Expo
  and React Native (SDK 58+). Covers component architecture, performance optimization,
  Zustand state management, offline persistence with AsyncStorage, Expo Vector Icons,
  Safe Area handling, config plugins in app.json, native device APIs (haptics, camera,
  printing receipts, sharing), and full-stack integration with Neon Postgres backends.
---

# Expo & React Native Skill Guide

This skill provides architecture guidelines and best practices for developing mobile applications with Expo and React Native, tailored for "The Gem: Onion Sales Tracker" and similar mobile-first business suites.

## 1. Project Architecture & Tooling

- **Expo SDK**: 58+ with React Native 0.88+ and React 19.
- **State Management**: Zustand stores with typed actions and selectors.
- **Local Persistence**: `@react-native-async-storage/async-storage` for offline caching and local persistence.
- **Styling**: `StyleSheet.create` with semantic design tokens defined in `src/constants/theme.ts`.
- **Icons**: `@expo/vector-icons` (Ionicons, MaterialCommunityIcons, FontAwesome5).
- **Safe Area**: `react-native-safe-area-context` (`useSafeAreaInsets`, `SafeAreaProvider`, `SafeAreaView`).

## 2. Common Expo Device Plugins & Libraries

When adding new mobile capabilities, prefer official Expo modules:

| Feature | Recommended Expo Module | Use Case in Wholesale / Retail Suite |
| :--- | :--- | :--- |
| **Receipts & Invoices** | `expo-print` & `expo-sharing` | Generating and sharing PDF sales receipts with buyers |
| **Tactile Feedback** | `expo-haptics` | Button taps, successful sales logging, credit alerts |
| **Camera / Barcode** | `expo-camera` or `expo-barcode-scanner` | Scanning batch QR tags or customer IDs |
| **Local Storage / Files**| `expo-file-system` | Storing exported sales CSVs / PDF reports |
| **Image Uploads** | `expo-image-picker` | Capturing seller ID photos or damaged stock images |
| **Device Notifications**| `expo-notifications` | Credit due reminders and merchant approval alerts |

## 3. Best Practices for Mobile UI & Performance

1. **Avoid unnecessary re-renders**:
   - Use atomic Zustand selectors (e.g. `useAppStore(s => s.role)` instead of destructuring the whole store).
2. **List Optimization**:
   - For long lists of sales, batches, or credit ledgers, use `FlatList` with `keyExtractor`, `getItemLayout`, and `windowSize` instead of mapping over `ScrollView`.
3. **Form & Numeric Inputs**:
   - Set `keyboardType="numeric"` or `"decimal-pad"` on price/weight inputs.
   - Use `returnKeyType="done"` and dismiss keyboard on action.
4. **Offline Resilience**:
   - Keep actions optimistic in Zustand, persisting mutations locally via AsyncStorage, and synchronizing with Neon Postgres when network is available.
5. **Config Plugins (`app.json`)**:
   - Whenever an Expo library requires native permissions (camera, notifications), configure the plugin in `app.json` under `"plugins"`.

## 4. Full-Stack Integration with Neon Postgres

- Pair Expo with Neon Postgres using serverless HTTP endpoints or Neon Functions / Hono API.
- Keep database connection strings off the client bundle; route through an API layer or secure token authentication.

## 5. Clerk Authentication (`@clerk/expo` Core 3) & Local Mobile Testing

- **Package:** Always use `@clerk/expo` (Core 3) instead of the deprecated `@clerk/clerk-expo` (which Clerk's API rejects). Import `ClerkProvider`, `useAuth`, `useClerk`, and `useSSO` from `@clerk/expo`, and `useSignIn` from `@clerk/expo/legacy` if using `signIn.create` / `prepareSecondFactor` / `attemptSecondFactor`.
- **Web OAuth (`Platform.OS === 'web'`):** Use `signIn.authenticateWithRedirect` + `clerk.handleRedirectCallback({})` in the root auth bridge instead of `WebBrowser.openAuthSessionAsync` popups (blocked by Google's `Cross-Origin-Opener-Policy`).
- **Expo Go OAuth Redirect:** Expo Go only intercepts `exp://` links, not custom `app.json` schemes. Build `exp://${Constants.expoGoConfig.debuggerHost}/--/oauth-callback` when `Constants.expoGoConfig?.debuggerHost` is present, and use `AuthSession.makeRedirectUri({ scheme, path: 'oauth-callback' })` for standalone/dev builds.
- **Email/Password `needs_client_trust`:** New mobile devices trigger `attempt.status === 'needs_client_trust'`. Handle this by finding `email_code` in `attempt.supportedSecondFactors`, calling `signIn.prepareSecondFactor({ strategy: 'email_code', emailAddressId })`, and completing with `signIn.attemptSecondFactor({ strategy: 'email_code', code })`.
- **Web Error Feedback & Already-Signed-In Guard:** `Alert.alert` is a no-op on `react-native-web`, so always render an inline error banner alongside `Alert.alert`. If `useAuth().isSignedIn` is already `true`, run backend sync directly instead of calling `signIn.create` / `authenticateWithRedirect`.
- **Networking & Tunneling:** Register `@fastify/cors` on the backend for Web, add an `AbortController` timeout (e.g. 12s) on `apiFetch`, use `npm run tunnel` (`expo start --web --tunnel ngrok`) for physical phones, and ensure port `3001` is allowed in `ufw` (`sudo ufw allow 3001/tcp`).
