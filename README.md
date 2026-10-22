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

### Installation
```bash
npm install
```

### Running Locally
```bash
# Start local development server (Web & Mobile)
npm run web
# Or start with Expo QR for mobile device
npx expo start
```

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
├── App.tsx                     # Main application container & screen coordinator
├── index.ts                    # Entry point registered with Expo
├── app.json                    # Expo configuration
├── package.json                # Project dependencies
└── src/
    ├── types/
    │   ├── index.ts            # Domain models (TruckBatch, Sales, Credit, Reconciliation)
    │   └── regions.ts          # Hierarchical origin regions (Kenya & Tanzania)
    ├── constants/
    │   ├── theme.ts            # High-contrast daylight design tokens & jewel palette
    │   └── config.ts           # Market fee rates, demurrage, security parameters
    ├── services/
    │   ├── reconciliation.ts   # Pure domain reconciliation math engine
    │   └── security.ts         # Phone OTP auth, phone masking, and emergency lockdown
    ├── store/
    │   └── useAppStore.ts      # Central Zustand store (Offline-first state machine)
    └── components/
        ├── Header.tsx                 # Branding, role switcher, credit pill & panic killswitch
        ├── BatchOverviewCard.tsx      # Truck arrival, cess, stock progress & origin card
        ├── SalesLogger.tsx            # Dynamic bargaining, grade picker & payment logger
        ├── FinancialSummaryCard.tsx   # Real-time Cash/M-Pesa drawer & COB reconciler trigger
        ├── ReconciliationModal.tsx    # 14:00 COB physical bag count & cash balance audit
        ├── CreditLedgerModal.tsx      # Customer debt management & debt collection
        ├── NewBatchModal.tsx          # 05:00 AM truck onboarding & origin picker
        ├── ExpensesLaborModal.tsx     # Casual labor (vibarua) & fixed daily expenses
        ├── SellerManagementModal.tsx  # Hired seller quota allocation & target prices
        ├── AuthModal.tsx              # Phone + SMS OTP verification modal
        └── LockdownScreen.tsx         # High-security breach & panic freeze screen
```

---

## 🔒 Security & Data Protection (Kenya DPA 2019)

1. **Section 26 Rights:** Explicit consent flags (`marketingConsent`) recorded before adding customer contacts to marketing broadcast lists.
2. **Pseudonymization:** Customer phone numbers are masked in all general and seller views (`+254 7*** **78`).
3. **Audit Trail:** Every sale, debt repayment, and expense records the active user ID and timestamp.
4. **Emergency Kill-Switch:** Master emergency key (`MARIKITI-999-SECURE`) provides instant failsafe recovery.
