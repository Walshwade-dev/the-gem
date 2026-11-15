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
  | 'SWEEPING_AND_SANITATION'
  | 'DEMURRAGE' 
  | 'NCC_CESS' 
  | 'CASUAL_LABOR' 
  | 'TRANSPORT' 
  | 'OTHER';

export type CreditStatus = 'OUTSTANDING' | 'PARTIAL' | 'SETTLED';

export type CreditApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

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

export interface BatchPurchaseCosts {
  pricePerKg: number;              // Farm purchase price per kg (e.g. 95 Ksh)
  avgNetWeightKg: number;          // Average kg per sack (e.g. 90 kg)
  packagingNetUnitCost: number;    // Price per empty net sack (e.g. 45 Ksh)
  transportFee: number;            // Long-distance haulage/truck freight fee (e.g. 45,000 Ksh)
  brokerSourcingFee: number;       // Field sourcing / broker commission (e.g. 6,000 Ksh)
  farmLoadersSortersFee: number;   // Farm grading, sorting & loading labor (e.g. 4,500 Ksh)
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
  dayNumber: number;           // 1 to 5 (standard max 4 days, negotiable up to 5 days)
  isNegotiatedExtension?: boolean; // True if dayNumber === 5
  
  // Nairobi City Council (NCC) Entry Data
  nccDeclaredNets: number;     // Official count assessed by NCC inspectors on Day 1
  nccCessPaid: number;         // Cess fee paid to County Government for Day 1
  isNccCessPaid?: boolean;     // Whether NCC cess has been approved as paid by Master/Seller
  nccCessPaidAt?: string;      // Timestamp of NCC cess approval
  nccCessPaidBy?: string;      // Who approved the NCC payment (Master or Sales)

  // Opening Stock Breakdown
  initialGrade1Nets: number;   // Grade 1 (large bulbs, premium)
  initialGrade2Nets: number;   // Grade 2 (medium/small bulbs, cheaper)
  
  // Remaining Stock (Computed & Reconciled at COB)
  remainingGrade1Nets: number;
  remainingGrade2Nets: number;
  unassignedGrade1Nets?: number;
  unassignedGrade2Nets?: number;

  // Visual Produce Cataloging
  photoUrls: string[];         // Produce condition pictures (quality comparison & social marketing)
  qualityNotes?: string;

  // Master Inbound Purchasing & Sourcing Expenses
  purchaseCosts?: BatchPurchaseCosts;

  // Master Selling Prices & Floor Minimums
  pricePerBagGrade1?: number;  // Master active selling price for Grade 1
  minPriceGrade1?: number;     // Master minimum floor price for Grade 1
  pricePerBagGrade2?: number;  // Master active selling price for Grade 2
  minPriceGrade2?: number;     // Master minimum floor price for Grade 2
  packagingKg?: number;        // Standard package net size in KG (e.g. 100, 50, 80)

  // Status
  status: BatchStatus;
  createdAt: string;
  closedAt?: string;
}

/**
 * Batch Produce Product Item
 * Represents a packaging/grading variant belonging to a batch,
 * including photos, descriptions, pricing, and promotional tags.
 */
export interface BatchProduct {
  id: string;
  batchId?: string;
  title: string;
  grade: ProduceGrade;
  packaging: '100KG_NET' | '50KG_BAG' | '10KG_POCKET' | string;
  weightKg: number;
  pricePerBag: number;
  minPrice?: number;           // Master minimum floor price
  availableBags: number;
  origin: string;
  photoUrl: string;
  photoUrls?: string[]; // Multiple views of the same product (e.g., net stack & bulb close-up)
  description?: string;
  tags: string[];
  createdAt?: string;
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
  isPaid?: boolean;
  paidAt?: string;
  paidByRole?: UserRole;
  paidByName?: string;
}

/**
 * Hired Seller Allocation: Merchant assigns quota & expected price
 */
export interface SellerAllocation {
  id: string;
  batchId: string;
  sellerId: string;
  sellerName: string;
  sellerPhone: string;         // Assigned seller mobile phone for OTP login
  sellerNationalId?: string;   // Single source of truth ID assigned by master
  date: string;
  grade1Allocated: number;
  grade2Allocated: number;
  expectedPriceG1: number;     // Target baseline price (e.g. 1,300 Ksh)
  expectedPriceG2: number;     // Target baseline price (e.g. 800 Ksh)
  grade1Sold: number;
  grade2Sold: number;
  acknowledgmentStatus?: 'PENDING' | 'ACKNOWLEDGED' | 'DISCREPANCY';
  acknowledgedAt?: string;
  discrepancyNote?: string;
  physicalCountGrade1?: number;
  physicalCountGrade2?: number;
}

/**
 * Staff Activity Audit Trail Log (Master Account Real-Time Feed)
 */
export interface StaffActivityLog {
  id: string;
  timestamp: string;
  staffName: string;
  staffRole: UserRole;
  actionType:
    | 'STOCK_ACKNOWLEDGED'
    | 'STOCK_DISCREPANCY_RAISED'
    | 'SALE_RECORDED'
    | 'CREDIT_ISSUED'
    | 'CREDIT_REPAID'
    | 'COB_RECONCILIATION_SUBMITTED'
    | 'POLICY_ACCEPTED'
    | 'APP_LOGIN';
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Individual Sale Transaction: Captures real-time negotiated pricing
 */
export interface SaleTransaction {
  id: string;
  batchId: string;
  sellerId: string;            // Either Merchant or Hired Seller
  sellerName?: string;         // Display name of salesperson who recorded the sale
  timestamp: string;
  grade: ProduceGrade;
  quantityNets: number;
  negotiatedUnitPrice: number; // Agreed price per sack for this sale
  totalAmount: number;         // quantity * negotiatedUnitPrice
  paymentMethod: PaymentMethod;
  mpesaReceiptCode?: string;
  buyerName?: string;          // Encrypted / pseudonymized under Kenya DPA
  buyerPhone?: string;         // Encrypted under Kenya DPA
  buyerNationalId?: string;    // Kenyan National ID (e.g. 28394812)
  customerNotes?: string;      // Specification preferences (e.g. 50kg, jumbo, dry-cured)
  creditRecordId?: string;     // Populated if paymentMethod === 'CREDIT'
  creditApprovalStatus?: CreditApprovalStatus;
}

export type InHouseCreditRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'HIGH_RISK';

/**
 * Customer Credit & Debt Record
 */
export interface CustomerCredit {
  id: string;
  customerName: string;
  customerPhone: string;
  customerNationalId?: string; // Kenyan National ID
  marketingConsent: boolean;   // Kenya DPA 2019 compliance check
  totalOutstandingCredit: number;
  creditScore?: number;        // In-house score (0-100)
  creditRating?: InHouseCreditRating;
  records: CreditEntry[];
}

export interface CreditEntry {
  id: string;
  saleId: string;
  batchId: string;
  batchNumber?: string;
  truckPlate: string;            // Direct truck attribution
  originRegion: string;          // Region of origin (e.g. Northern Tanzania)
  originSpecificLocation: string;// Specific farm / market locality
  dateIssued: string;            // Original date at which credit occurred
  authorizedBy: string;          // Master or authorized seller who approved the credit
  sellerId?: string;             // Person liable for the crediting
  sellerName?: string;           // Name of sales person in charge
  personLiable?: string;         // Explicit staff member accountable
  creditScore?: number;          // In-house credit score at issue time
  creditRating?: InHouseCreditRating;
  grade: ProduceGrade;
  quantityNets: number;
  totalOwed: number;
  amountPaid: number;
  status: CreditStatus;
  approvalStatus: CreditApprovalStatus; // PENDING master approval, APPROVED, or REJECTED
  dueDate?: string;
  repayments: CreditRepayment[];
  buyerConsentConfirmed?: boolean;
  buyerNationalId?: string;       // Kenyan National ID
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorNationalId?: string;   // Kenyan National ID of Guarantor
  guarantorRole?: string;
}

export interface CreditRepayment {
  id: string;
  creditEntryId: string;
  batchId: string;               // Direct attribution back to original stock batch
  truckPlate: string;            // Direct attribution back to original truck
  originRegion: string;          // Direct attribution back to origin for regional P&L
  originSpecificLocation: string;
  dateIssued: string;            // Original credit issue date
  authorizedBy: string;          // Who originally authorized the credit
  timestamp: string;             // When repayment occurred
  amountPaid: number;
  paymentMethod: 'CASH' | 'MPESA';
  mpesaReceiptCode?: string;
  collectedBy: string;           // Person who received the cash/mpesa
}

/**
 * Daily 14:00 Close of Business (COB) Reconciliation Sheet
 */
export interface DailyReconciliation {
  id: string;
  batchId: string;
  batchNumber?: string;
  truckPlate?: string;
  dayNumber?: number;
  date: string;
  cobTimestamp: string;        // ~14:00 hrs
  salesPersonInCharge?: string;
  salesPersonId?: string;
  
  // Stock Reconciliation
  openingStockGrade1?: number;
  openingStockGrade2?: number;
  totalOpeningStock?: number;

  physicalCountGrade1: number;
  physicalCountGrade2: number;
  totalClosingStock?: number;

  expectedRemainingGrade1: number;
  expectedRemainingGrade2: number;
  varianceGrade1: number;      // physical - expected (negative = loss/spoilage)
  varianceGrade2: number;

  // Nets Sold (Difference between opening and closing)
  soldGrade1Nets?: number;
  soldGrade2Nets?: number;
  totalSoldNets?: number;

  // Benchmark / Set Expected Price calculations
  expectedPriceGrade1?: number;
  expectedPriceGrade2?: number;
  expectedGrossRevenueGrade1?: number;
  expectedGrossRevenueGrade2?: number;
  totalExpectedGrossRevenue?: number;

  // Actual Negotiated Sales Summation
  cashSalesToday: number;
  mpesaSalesToday: number;
  totalCreditExtendedToday: number;
  totalSalesSummation?: number;
  cashCreditRepaymentsToday: number; // Debt collected from PREVIOUS days
  mpesaCreditRepaymentsToday: number;

  // Expenses Deductions
  cashExpensesPaidToday: number;
  mpesaExpensesPaidToday: number;
  totalExpensesDeducted?: number;

  // Balancing & Cash Transfer
  expectedCashInHand: number;
  actualCashInHand: number;
  cashDiscrepancy: number;
  expectedMpesaWallet: number;
  netCashTransferredToMaster?: number;

  reconciledBy: string;
  notes?: string;
  status: 'BALANCED' | 'DISCREPANCY' | 'AUDIT_FLAGGED';

  // Master Approval Workflow
  masterApprovalStatus?: 'PENDING_MASTER_APPROVAL' | 'APPROVED';
  masterApprovedAt?: string;
  masterApprovedBy?: string;
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
