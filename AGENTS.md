This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Design System & Reference Visual Architecture

- **Styling Engine**: The app uses NativeWind v4 (Tailwind CSS v3) configured with `withNativeWind` in `metro.config.js` and `global.css`.
- **Reference Typography Scale**:
  - **Display**: Geometric sans bold 56–44 (line-height 1.0).
  - **Heading**: Geometric sans bold 28–32 (line-height 1.2).
  - **Body**: Geometric sans regular 16 (line-height 1.5).
  - **Caption**: Geometric sans medium 14.
  - **Buttons**: Geometric sans medium 17–18.
- **Design Tokens**: Standard tokens are declared in `tailwind.config.js` and mapped to `src/constants/theme.ts`:
  - **Turquoise Primary**: `turquoise-600` (`#0891B2`), `turquoise-500` (`#06B6D4`), `turquoise-50` (`#ECFEFF`).
  - **Harvest Amber**: `amber-600` (`#D97706`), `amber-500` (`#F59E0B`), `amber-100` (`#FEF3C7`).
  - **M-Pesa Emerald**: `emerald-600` (`#059669`), `emerald-100` (`#D1FAE5`).
  - **Vanta Dark**: `vanta-bg` (`#000000`), `vanta-surface` (`#0A0A0A`), `vanta-card` (`#0F0F11`), `vanta-border` (`#1F1F23`).
  - **Corner Radii**: `sm: 4px`, `md: 8px`, `lg: 12px`, `xl: 16px`, `card: 24px`, `full: 9999px`.
  - **Stroke Widths**: `hairline: 1px`, `normal: 1.5px`, `thick: 2px`.
- **Navigation**: Floating liquid glass bottom bar with frosted backdrop blur, active pill tab indicator, and pending notification badge.
- **Produce Listings & Adverts**: Produce cards must show grade badges, advert tags (`New Stock`, `Discounted`, `Large Size`, `Medium Size`, `Small Size`), and both total sack price and calculated per-kilogram price.
- **Domain Modeling**:
  - Outstanding credit must always read from `CustomerCredit.totalOutstandingCredit`.
  - Truck origin is an `OriginDetails` object — display via `currentBatch.origin.regionName` rather than string coercion.
- **Layout Consistency**: Form cards and auth containers must maintain fixed max-widths (e.g. `max-w-[440px] w-full self-center`) with established minimum heights to prevent visual jumping during tab switching or state toggles.
- **High Contrast Standard**: Maintain outdoor market daylight readability (minimum 4.5:1 contrast ratio) alongside the Vanta OLED dark theme.
- **Master Admin & Store Identity**:
  - The business owner/admin is officially titled **Master** (or Master Admin) across all customer-facing and staff-facing UI text (internal role remains `MERCHANT`).
  - Master Admin Name (`currentUserName`) and Business Store Name (`storeName`) are strictly independent entities. Modifying the admin's personal name never alters the store/business name.
  - Profile displays Master Name, Store Name, Mobile Phone, and National ID, all editable via dedicated forms.
- **Master Consignment Bookkeeping & Ledger Receipt**:
  - Profit margins and wholesale batch balancing are removed from the profile and housed in the **Master Ledger Receipt** (`MasterBatchLedgerReceipt.tsx`) on the Ledger tab (`credits`).
  - Consignment purchase expenses tracked: `pricePerKg` × total weight (kg), `packagingNetUnitCost` × nets used, Day 1 Nairobi City County (NCC) cess, transport haulage freight, origin broker sourcing fee, and farm loaders/sorters labor.
  - Market overheads tracked: County demurrage (Days 2–4 flat Ksh 1,000/day), Night security watchman (Ksh 100/night), Sweeping & sanitation (Ksh 100/day), and casual offloaders (Ksh 700/worker). Morning chai and mandazi are personal and excluded from store expenses.
  - Receipt provides real-time flowing thermal-receipt output balancing realized inflows (Cash, M-Pesa, Repaid debt) against total outflows, calculating live surplus/deficit, cost recovery %, and projected clearance net margin.
- **Operational Policies & Standards**:
  - Abstract haulage examples (use "bulk farm production hubs" instead of specific names) and avoid fixed county cess per-net figures (use "official NCC barcode receipt as assessed by county gate inspectors").
  - Mandatory liability acknowledgment for Master and Sales Agents with digital acceptance record.
- **Credited Persons & Debtor Governance (ISMS & QMS Separation)**:
  - Credit records are accessible via the Ledger tab (`credits`) under a dedicated sub-view (`CreditRecordsView.tsx`) grouped by Stock Batch and Date Issued.
  - Multi-filtering capabilities: Date issued, Payment status (Pending/Unpaid vs Credit Paid), Person Liable (salesperson accountable), and In-House Credit Score rating (`EXCELLENT` [80+], `GOOD` [65-79], `FAIR` [50-64], `HIGH_RISK` [<50]).
  - **ISMS & QMS Role Segregation**: For a Salesperson (`SELLER`), the view is strictly constrained to only debtor records issued during their own sales sessions. They cannot view other sellers' debtors or store-wide default risk. The Master (`MERCHANT`) views all debtors with staff liability attribution and approval controls.
- **14:00 COB End-of-Day Reconciliation & Daily Closure Receipt**:
  - When Close of Business reconciliation is executed, a thermal receipt-like record (`DailyClosureReceipt.tsx`) is generated and preserved in store history.
  - Captures: Day of stay (e.g. Day 1 of 4), Stock batch, Truck registration, Salesperson in charge, Recipient Master account.
  - Stock Movement: Opening stock, closing stock, nets sold difference.
  - Difference Calculation: Grade 1 & 2 nets sold multiplied by set expected selling prices (G1: Ksh 1,300, G2: Ksh 1,200) to compute expected benchmark gross revenue vs actual negotiated sales.
  - Gross Sales Summation (Cash + M-Pesa + Credit + Repaid debt).
  - Expense Deductions (Night watchman, sweeping & sanitation, demurrage, casual offloaders).
  - Cash Handover Balancing: Net cash transferred to Master account with discrepancy variance auditing.
  - Master Approval Workflow: Receipt holds state `PENDING_MASTER_APPROVAL` until signed off by the Master Administrator (`APPROVED`).
