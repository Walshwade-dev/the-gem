// ============================================================================
// The Gem: Onion Sales Tracker - Core Domain Types
// Specialized for Wakulima Market (Marikiti), Nairobi Wholesale Operations
// ============================================================================

export type UserRole = 'MERCHANT' | 'SELLER';

export type ProduceGrade = 'GRADE_1' | 'GRADE_2';

export type PaymentMethod = 'CASH' | 'MPESA' | 'CREDIT';

export type BatchStatus = 'ACTIVE' | 'CLOSED' | 'LOCKED';

export type ExpenseCategory = 
  | 'WATCHMAN' 
  | 'CLEANER' 
  | 'DEMURRAGE' 
  | 'NCC_CESS' 
  | 'CASUAL_LABOR' 
  | 'MEALS' 
  | 'TRANSPORT' 
  | 'OTHER';

export type CreditStatus = 'OUTSTANDING' | 'PARTIAL' | 'SETTLED';

/**
 * Hierarchical Origin Definition (Merchant Only)
 * Used to track performance, spoilage susceptibility, and profitability by source.
 */
export interface OriginRegion {
  regionId: string;       // e.g., 'TZ-NORTH', 'KE-RIFT', 'KE-CENTRAL'
  regionName: string;     // e.g., 'Northern Tanzania', 'Rift Valley Kenya'
  country: 'KENYA' | 'TANZANIA' | 'OTHER';
  suggestedDistricts: string[]; // e.g. ['Singida', 'Karatu', 'Arusha'] or ['Oloitokitok', 'Mai Mahiu']
}

export interface OriginDetails {
  regionId: string;
  regionName: string;
  specificLocation: string; // e.g., "Oloitokitok - Rom Farm", "Mai Mahiu - Suswa Junction"
  farmerSupplierNotes?: string;
}

/**
 * Truck Batch: Represents a single truck arriving at Wakulima Market
 * Max stay: 4 days.
 * Day 1: Standard entry/cess. Days 2-4: 1,000 Ksh / day demurrage.
 */
export interface TruckBatch {
  id: string;
  batchNumber: string;         // e.g., "WB-20261022-01"
  truckPlate: string;          // e.g., "KDE 421B"
  origin: OriginDetails;       // Restricted to Merchant view
  arrivalTime: string;         // ISO timestamp (typically ~05:00 hrs)
  dayNumber: number;           // 1 to 4
  
  // Nairobi City Council (NCC) Entry Data
  nccDeclaredNets: number;     // Official count assessed by NCC inspectors
  nccCessPaid: number;         // Cess fee paid to County Government

  // Opening Stock Breakdown
  initialGrade1Nets: number;   // Grade 1 (large bulbs, premium)
  initialGrade2Nets: number;   // Grade 2 (medium/small bulbs, cheaper)
  
  // Remaining Stock (Computed & Reconciled at COB)
  remainingGrade1Nets: number;
  remainingGrade2Nets: number;

  // Visual Produce Cataloging
  photoUrls: string[];         // Produce condition pictures (quality comparison & social marketing)
  qualityNotes?: string;

  // Status
  status: BatchStatus;
  createdAt: string;
  closedAt?: string;
}

/**
 * Daily Fixed Overheads & Casual Labor (Vibarua)
 */
export interface CasualLaborer {
  id: string;
  batchId: string;
  date: string;
  workerName: string;          // e.g., "Otieno", "Kamau", "Wafula"
  task: 'OFFLOAD' | 'SORTING' | 'SELLING_HELP' | 'GUARD';
  agreedWage: number;          // Individually negotiated daily rate (e.g. 700 Ksh)
  isPaid: boolean;
  paidVia?: 'CASH' | 'MPESA';
}

export interface DailyExpense {
  id: string;
  batchId: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidVia: 'CASH' | 'MPESA';
  receiptRef?: string;
}

/**
 * Hired Seller Allocation: Merchant assigns quota & expected price
 */
export interface SellerAllocation {
  id: string;
  batchId: string;
  sellerId: string;
  sellerName: string;
  date: string;
  grade1Allocated: number;
  grade2Allocated: number;
  expectedPriceG1: number;     // Target baseline price (e.g. 2,500 Ksh)
  expectedPriceG2: number;     // Target baseline price (e.g. 2,000 Ksh)
  grade1Sold: number;
  grade2Sold: number;
}

/**
 * Individual Sale Transaction: Captures real-time negotiated pricing
 */
export interface SaleTransaction {
  id: string;
  batchId: string;
  sellerId: string;            // Either Merchant or Hired Seller
  timestamp: string;
  grade: ProduceGrade;
  quantityNets: number;
  negotiatedUnitPrice: number; // Agreed price per sack for this sale
  totalAmount: number;         // quantity * negotiatedUnitPrice
  paymentMethod: PaymentMethod;
  mpesaReceiptCode?: string;
  buyerName?: string;          // Encrypted / pseudonymized under Kenya DPA
  buyerPhone?: string;         // Encrypted under Kenya DPA
  creditRecordId?: string;     // Populated if paymentMethod === 'CREDIT'
}

/**
 * Customer Credit & Debt Record
 */
export interface CustomerCredit {
  id: string;
  customerName: string;
  customerPhone: string;
  marketingConsent: boolean;   // Kenya DPA 2019 compliance check
  totalOutstandingCredit: number;
  records: CreditEntry[];
}

export interface CreditEntry {
  id: string;
  saleId: string;
  batchId: string;
  dateIssued: string;
  grade: ProduceGrade;
  quantityNets: number;
  totalOwed: number;
  amountPaid: number;
  status: CreditStatus;
  dueDate?: string;
  repayments: CreditRepayment[];
}

export interface CreditRepayment {
  id: string;
  creditEntryId: string;
  timestamp: string;
  amountPaid: number;
  paymentMethod: 'CASH' | 'MPESA';
  mpesaReceiptCode?: string;
  collectedBy: string;         // Person who received the cash/mpesa
}

/**
 * Daily 14:00 Close of Business (COB) Reconciliation Sheet
 */
export interface DailyReconciliation {
  id: string;
  batchId: string;
  date: string;
  cobTimestamp: string;        // ~14:00 hrs
  
  // Stock Reconciliation
  physicalCountGrade1: number;
  physicalCountGrade2: number;
  expectedRemainingGrade1: number;
  expectedRemainingGrade2: number;
  varianceGrade1: number;      // physical - expected (negative = loss/spoilage)
  varianceGrade2: number;

  // Cash Drawer Reconciliation
  cashSalesToday: number;
  cashCreditRepaymentsToday: number; // Debt collected from PREVIOUS days
  cashExpensesPaidToday: number;
  expectedCashInHand: number;
  actualCashInHand: number;
  cashDiscrepancy: number;

  // M-Pesa Drawer Reconciliation
  mpesaSalesToday: number;
  mpesaCreditRepaymentsToday: number;
  mpesaExpensesPaidToday: number;
  expectedMpesaWallet: number;

  // Credit Issued
  totalCreditExtendedToday: number;

  reconciledBy: string;
  notes?: string;
  status: 'BALANCED' | 'DISCREPANCY' | 'AUDIT_FLAGGED';
}

/**
 * Security & Emergency Lockdown State
 */
export interface SecurityState {
  isLockedDown: boolean;
  lockdownReason?: string;
  lockdownTimestamp?: string;
  failedAuthAttempts: number;
  maxFailedAttemptsBeforeLockout: number;
  isBiometricsAvailable: boolean;
  activeSessionRole: UserRole;
  activeUserId: string;
  activeUserName: string;
  activeUserPhone: string;
}
