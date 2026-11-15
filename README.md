# The Gem: Onion Sales Tracker
### Wakulima Market (Marikiti) Wholesale Management Suite

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Walshwade-dev/the-gem)

---

## 📌 Overview

**The Gem** is a specialized, production-grade native application built for onion wholesale merchants operating at **Wakulima Market (Marikiti)** along Haile Selassie Avenue in Nairobi, Kenya.

Designed for non-technical users in fast-paced, high-volume market environments, it combines ergonomic, high-contrast touch interfaces with institutional-grade financial reconciliation, role-based delegation, and compliance with the **Kenya Data Protection Act (DPA 2019)**.

---

## 🧅 Wakulima Market Domain Realities & Features

### 1. 05:00 AM Truck Onboarding & NCC Cess
- Arriving trucks are registered with their registration plate, origin, and photo catalog.
- **Nairobi City Council (NCC)** net count and cess fee (Ksh 70/net standard) are logged.
- Opening stock declared across **Grade 1 (G1 - Kubwa)** and **Grade 2 (G2 - Ndogo)**.
- **Hierarchical Origin Tracking (Merchant Restricted):** Merchants select the Region of Origin (e.g. *Northern Tanzania, Kajiado South, Rift Valley, Central Kenya*) and specify the exact farm or locality (e.g. *Singida - Iramba Plains, Rom Farm Section 4*). This data feeds analytics on spoilage susceptibility, market uptake, and regional profitability.

### 2. 4-to-5 Day Market Stay & Municipal Fees
- **Standard Stay:** Trucks are permitted 4 days at the bay, extendable to a **5th day upon negotiation**.
- **Day 1 Municipal Cess:** Paid per-net (e.g. Ksh 70/net) covering Day 1 in full.
- **Consecutive Days (Days 2 to 5):** **Nets are NOT counted again by NCC officials!** Instead, NCC inspectors collect a flat **Ksh 1,000 / day** fee.
- **Fixed Daily Overheads:** Automatically logs **Ksh 200/day** (Watchman: Ksh 100 + Bay Cleaners: Ksh 100) accrued daily.
- **Casual Labor (Vibarua):** Records 1 to 3+ handlers (offloaders, sorters, selling assistants) with individually negotiated wages (e.g. Otieno: Ksh 700, Kamau: Ksh 600) and payout modes.

### 3. Dynamic Bargain Sales & Payment Tiers
- **Grade 1 vs. Grade 2:** One-tap toggle with baseline price targets.
- **Dynamic Price Negotiation:** Quick adjustment chips (`-50`, `+50`) and direct input to capture the exact bargained rate per net.
- **Multi-Channel Payments:**
  - **Direct Cash:** Tracked in real time for evening drawer count.
  - **M-Pesa:** Captures transaction codes / sender numbers (ready for future Safaricom Daraja STK push integration).
  - **Credit (Deni):** Extended to trusted buyers with full stock lineage.

### 4. Credit Ledger (Kitabu cha Madeni) & Stock Lineage
- Real-time debtor dashboard.
- **Stock Lineage Attribution:** Every credit transaction and subsequent repayment is strictly attached to:
  $$\text{Credit Record} \longrightarrow [\text{Truck Plate}] + [\text{Farm Origin}] + [\text{Date Issued}] + [\text{Authorized By}]$$
- **Debt Repayment (Kulipa Deni):** Collecting debt from past sales credits today's Cash or M-Pesa drawer **without falsely inflating today's sack sales volume**.
- **Kenya DPA 2019 Compliance:** Customer phone numbers are masked and pseudonymized.

### 5. Hired Seller Delegation (Role-Based Access Control)
- **Merchant (Owner / Admin):** Complete visibility into stock, margins, farm origins, demurrage, and master financials.
- **Hired Seller:** Restricted mode. Only sees their assigned stock quota (e.g. 40 G1, 20 G2) and target prices. Farm origins, purchase costs, and sensitive analytics remain locked.

### 6. 14:00 Close of Business (COB) Reconciliation (Hesabu ya Siku)
- **Physical Sack Count:** Physical audit of remaining G1 & G2 nets compared against theoretical stock ($\text{Initial} - \text{Sold}$) to immediately identify shrinkage, spoilage, or theft.
- **Cash & M-Pesa Drawer Reconciliation:** Calculates expected cash in hand ($\text{Cash Sales} + \text{Debt Collected} - \text{Cash Expenses}$) and compares against physical banknote counting.

### 7. Security, Tamper Watchdog & Emergency Lockdown
- **Phone + SMS OTP Auth:** Secure role-based login via 6-digit OTP.
- **Emergency Kill-Switch:** Automatically triggered upon 5 consecutive failed attempts or manually via the panic button. Freezes all seller sessions and locks the database until the Master Admin inputs the recovery key (`MARIKITI-999-SECURE`).

---

## 🚀 Getting Started & Local Development

### 1. Backend (`server/`)
```bash
cd server
npm install
npm run dev:local   # Starts Fastify on http://0.0.0.0:3001 with local PGlite (.local-pgdata)
```

### 2. Frontend (`frontend/`)
```bash
cd frontend
npm install
# Start Web + Metro with ngrok tunnel for direct physical-phone testing in Expo Go
npm run tunnel
# Or standard local dev server (Web & LAN/Emulator)
npm run web
```

### 3. Physical Phone & Emulator Testing Notes
- **Environment:** Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:3001` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `frontend/.env.local`.
- **Firewall (Linux/ufw):** Allow port `3001` so your phone on the same Wi-Fi can reach the local backend:
  ```bash
  sudo ufw allow 3001/tcp
  ```
- **Verify Reachability:** Open `http://<YOUR_LAN_IP>:3001/health` (explicit `http://`, **not** `https://`) in your phone's browser and confirm `{"status":"ok"}`.
- **Android Emulator:** Forward ports if needed with `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:3001 tcp:3001`.

### 4. Clerk Authentication & Troubleshooting Reference
- **SDK Version:** Uses `@clerk/expo` (Core 3) instead of the deprecated `@clerk/clerk-expo` (which Clerk's API rejects with *"outdated version of Clerk"*). `ClerkProvider`, `useAuth`, `useClerk`, and `useSSO` come from `@clerk/expo`; `useSignIn` comes from `@clerk/expo/legacy`.
- **Web Google OAuth:** Uses `signIn.authenticateWithRedirect` + `clerk.handleRedirectCallback({})` in `ClerkAuthBridge` (`frontend/App.tsx`) rather than `WebBrowser.openAuthSessionAsync` popups (which fail under Google's `Cross-Origin-Opener-Policy`).
- **Expo Go Google OAuth Redirect:** Expo Go only intercepts `exp://` deep links, not custom `thegem://` schemes. `LoginScreen.tsx` builds `exp://${Constants.expoGoConfig.debuggerHost}/--/oauth-callback` in Expo Go and falls back to `AuthSession.makeRedirectUri({ scheme: 'thegem', path: 'oauth-callback' })` for standalone/dev builds.
- **Email + Password `needs_client_trust`:** New mobile devices trigger Clerk's Client Trust second-factor email OTP (`status: 'needs_client_trust'`). `LoginScreen.tsx` calls `signIn.prepareSecondFactor({ strategy: 'email_code', emailAddressId })`, renders the verification code screen, and completes login with `signIn.attemptSecondFactor`.
- **Backend CORS & Request Timeout:** `@fastify/cors` is registered in `server/src/app.ts` for Web requests; `apiFetch` in `frontend/src/services/api.ts` routes `localhost` Web requests to `http://localhost:3001` and enforces a 12-second `AbortController` timeout so unreachable backends surface an error instead of hanging on `CONNECTING...`.
- **Web Error Visibility:** `Alert.alert` is a no-op in `react-native-web`, so `LoginScreen.tsx` renders an inline error banner alongside `Alert.alert`.

---

## 🌐 Deploying Online to Render

This project includes a native Render Blueprint ([`render.yaml`](render.yaml)) configured for zero-config **Static Site** deployment on Render's global CDN:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Walshwade-dev/the-gem)

### Method 1: Instant 1-Click Blueprint Deploy
Simply open this link in your browser:
**👉 [Deploy The Gem on Render](https://render.com/deploy?repo=https://github.com/Walshwade-dev/the-gem)**

Render will automatically detect `render.yaml`, set up the build command (`npm install && npm run build`), and deploy to `./dist`.

### Method 2: Manual Setup via Dashboard
1. Go to your **[Render Dashboard](https://dashboard.render.com/)**.
2. Click **New +** $\rightarrow$ **Static Site**.
3. Connect your GitHub repository `Walshwade-dev/the-gem`.
4. Fill in the build settings:
   - **Name:** `the-gem` (or custom)
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
5. Under **Advanced / Rewrites**, add an SPA rewrite rule:
   - **Type:** `Rewrite`
   - **Source:** `/*`
   - **Destination:** `/index.html`
6. Click **Create Static Site** — your public link will be live in ~1 minute (e.g. `https://the-gem.onrender.com`).

---

## 🏗️ Software Architecture & Directory Layout

```
onion sales/
├── frontend/                   # Expo SDK 58 / React Native 0.88 client (Web, Android, iOS)
│   ├── App.tsx                 # Main application coordinator, Clerk Core 3 auth bridge & modals
│   ├── index.ts                # Expo entry point
│   ├── app.json                # Expo configuration
│   ├── package.json            # Frontend dependencies & build scripts
│   └── src/
│       ├── types/              # Domain models (TruckBatch, Sales, Credit, Reconciliation, Regions)
│       ├── constants/          # Coolors dark/light theme tokens & market configuration
│       ├── services/           # API client (12s timeout), reconciliation engine, security & OTP auth
│       ├── store/              # Zustand state store with in-flight sync deduplication & persistence
│       └── components/
│           ├── Header.tsx                 # Branding, role switcher, credit alert pill & killswitch
│           ├── LiquidGlassBottomBar.tsx   # Compact 40px icon-only floating tab bar with tap toast
│           ├── BatchOverviewCard.tsx      # Truck arrival, cess, stock progress & origin card
│           ├── SalesLogger.tsx            # Bargaining, grade picker & Master-governed payment modes
│           ├── FinancialSummaryCard.tsx   # Real-time Cash/M-Pesa drawer & COB reconciler trigger
│           ├── CreditRecordsView.tsx      # Active debt tracking, high-risk exposure & SOP links
│           ├── DailyClosureReceipt.tsx    # Master COB receipt, Live Audit Stream & approval controls
│           ├── MasterBatchLedgerReceipt.tsx # Master batch ledger & expense/labor breakdown
│           └── UserProfileSection.tsx     # Profile, policy links, Sign Out & store payment mode toggles
└── server/                     # Node.js / Express / Drizzle ORM + PostgreSQL backend API
    ├── package.json            # Backend dependencies, Vitest acceptance suite & dev:local script
    └── src/
        ├── db/                 # Drizzle schema, migrations & pg/pglite connection
        ├── middleware/         # Clerk JWT & seller token verification, CORS & rate limiting
        ├── routes/             # REST endpoints (/sync, /batches, /sales, /credit, /auth, etc.)
        └── tests/              # Phase 2A backend acceptance tests (Vitest + PGlite)
```

---

## ✨ Recent Updates & Performance Improvements

- **UI & Dark Mode Consistency (Coolors Palette):** Unified dark mode surfaces (`#1D575D`, `#256A71`, `#1B4F55`) with `#FDE68A` accent outlines/badges, `#EE6C4D` high-risk credit exposure, and `#F0FDFA`/`#CFE9EC` high-contrast typography across `Header`, `DailyClosureReceipt`, `MasterBatchLedgerReceipt`, `CreditRecordsView`, `BatchOverviewCard`, and `UserProfileSection`.
- **Master Payment Mode Governance:** Masters can toggle accepted payment modes (`Cash`, `M-Pesa`, `Credit / Madeni`) from the Profile tab (`UserProfileSection`), immediately governing available payment options in `SalesLogger`.
- **Navigation & Receipt Refinements:** Compact `40px` icon-only `LiquidGlassBottomBar` with brief tap feedback labels; streamlined `DailyClosureReceipt` with matched Live Audit Stream styling and legible section totals.
- **Speed & Render Optimizations:**
  - Parallelized `/sync` database reads in `server/src/routes/sync.ts` via `Promise.all` (replacing ~21 sequential queries and per-row ledger awaits).
  - Added in-flight `syncFromServer` promise deduplication in `frontend/src/store/useAppStore.ts` to prevent duplicate `/sync` network requests.
  - Switched high-frequency components (`MainScreen`, `Header`, `BatchOverviewCard`, `FinancialSummaryCard`, `SalesLogger`) to targeted `useShallow` Zustand selectors and `useMemo` derived values.

---

## 🔒 Security & Data Protection (Kenya DPA 2019)

1. **Section 26 Rights:** Explicit consent flags (`marketingConsent`) recorded before adding customer contacts to marketing broadcast lists.
2. **Pseudonymization:** Customer phone numbers are masked in all general and seller views (`+254 7*** **78`).
3. **Audit Trail:** Every sale, debt repayment, and expense records the active user ID and timestamp.
4. **Emergency Kill-Switch:** Master emergency key (`MARIKITI-999-SECURE`) provides instant failsafe recovery.
