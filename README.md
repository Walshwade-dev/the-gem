# The Gem: Onion Sales Tracker
### Wakulima Market (Marikiti) Wholesale Management Suite

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

### 2. 4-Day Market Stay & Operational Overheads
- **4-Day Maximum Stay:** Trucks are permitted up to 4 days at the bay.
- **Demurrage Tracking:** Day 1 is covered under entry cess. Days 2, 3, and 4 incur a consecutive-day demurrage fee of **Ksh 1,000 / day**.
- **Fixed Daily Overheads:** Automatically logs **Ksh 200/day** (Watchman: Ksh 100 + Bay Cleaners: Ksh 100).
- **Casual Labor (Vibarua):** Records 1 to 3+ handlers (offloaders, sorters, selling assistants) with individually negotiated wages (e.g. Otieno: Ksh 700, Kamau: Ksh 600) and payout modes.

### 3. Dynamic Bargain Sales & Payment Tiers
- **Grade 1 vs. Grade 2:** One-tap toggle with baseline price targets.
- **Dynamic Price Negotiation:** Quick adjustment chips (`-50`, `+50`) and direct input to capture the exact bargained rate per net.
- **Multi-Channel Payments:**
  - **Direct Cash:** Tracked in real time for evening drawer count.
  - **M-Pesa:** Captures transaction codes / sender numbers (ready for future Safaricom Daraja STK push integration).
  - **Credit (Deni):** Extended to trusted buyers with due dates and customer records.

### 4. Credit Ledger (Kitabu cha Madeni) & Collections
- Real-time debtor dashboard.
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

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ or v26+)
- npm or yarn
- Expo Go app on iOS or Android (optional, for physical device testing)

### Installation
```bash
npm install
```

### Running the Application

#### 1. In Your Web Browser
```bash
npm run web
```
Opens in your browser at `http://localhost:8081`.

#### 2. On Mobile via Expo Go
```bash
npx expo start
```
Scan the displayed QR code using the **Expo Go** app (Android) or the Camera app (iOS).

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
