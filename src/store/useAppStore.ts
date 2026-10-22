// ============================================================================
// The Gem: Onion Sales Tracker - Central Zustand Store
// Offline-First, Dual-Role (Merchant Admin vs Hired Seller)
// ============================================================================

import { create } from 'zustand';
import { 
  TruckBatch, 
  SaleTransaction, 
  DailyExpense, 
  CasualLaborer, 
  SellerAllocation,
  CustomerCredit, 
  CreditRepayment, 
  DailyReconciliation, 
  UserRole,
  ProduceGrade,
  PaymentMethod,
  OriginDetails
} from '../types';
import { MARKET_CONFIG } from '../constants/config';
import { calculateDailyReconciliation, calculateDemurrageFee } from '../services/reconciliation';
import { 
  triggerSecurityLockdown, 
  unlockSystemWithMasterKey, 
  verifySmsOtp, 
  requestSmsOtp 
} from '../services/security';

interface AppState {
  // Session & RBAC
  role: UserRole;
  currentUserId: string;
  currentUserName: string;
  currentUserPhone: string;
  isAuthenticated: boolean;

  // Security & Emergency Lockdown
  isLockedDown: boolean;
  lockdownReason?: string;

  // Active Truck Batch
  currentBatch: TruckBatch | null;
  historicalBatches: TruckBatch[];

  // Stock Allocations for Hired Sellers
  allocations: SellerAllocation[];

  // Sales Transactions
  sales: SaleTransaction[];

  // Expenses & Casual Labor (Vibarua)
  expenses: DailyExpense[];
  casualLaborers: CasualLaborer[];

  // Credit Ledger (Madeni)
  customerCredits: CustomerCredit[];
  creditRepayments: CreditRepayment[];

  // Reconciliation Records
  reconciliations: DailyReconciliation[];

  // Actions
  setRole: (role: UserRole) => void;
  requestLoginOtp: (phone: string, role: UserRole, name: string) => { success: boolean; message: string; mockOtp?: string };
  verifyLoginOtp: (otp: string) => { success: boolean; message: string; role?: UserRole };
  logout: () => void;
  lockdown: (reason: string) => void;
  unlock: (masterKey: string) => { success: boolean; message: string };

  // Batch Management
  createBatch: (params: {
    truckPlate: string;
    origin: OriginDetails;
    nccDeclaredNets: number;
    nccCessPaid: number;
    initialGrade1Nets: number;
    initialGrade2Nets: number;
    photoUrls: string[];
    qualityNotes?: string;
  }) => void;
  advanceBatchDay: () => void;
  closeCurrentBatch: () => void;

  // Seller Delegation
  allocateStockToSeller: (params: {
    sellerId: string;
    sellerName: string;
    grade1Allocated: number;
    grade2Allocated: number;
    expectedPriceG1: number;
    expectedPriceG2: number;
  }) => void;

  // Sales
  recordSale: (params: {
    grade: ProduceGrade;
    quantityNets: number;
    negotiatedUnitPrice: number;
    paymentMethod: PaymentMethod;
    buyerName?: string;
    buyerPhone?: string;
    mpesaReceiptCode?: string;
  }) => { success: boolean; message: string };

  // Credit Repayment Collection
  recordCreditRepayment: (params: {
    customerId: string;
    creditEntryId: string;
    amount: number;
    paymentMethod: 'CASH' | 'MPESA';
    mpesaReceiptCode?: string;
  }) => void;

  // Expenses & Casual Labor
  addDailyExpense: (params: {
    category: DailyExpense['category'];
    description: string;
    amount: number;
    paidVia: 'CASH' | 'MPESA';
    receiptRef?: string;
  }) => void;
  addCasualLaborer: (params: {
    workerName: string;
    task: CasualLaborer['task'];
    agreedWage: number;
    isPaid: boolean;
    paidVia?: 'CASH' | 'MPESA';
  }) => void;
  markLaborerPaid: (laborerId: string, paidVia: 'CASH' | 'MPESA') => void;

  // Reconciliation
  performCobReconciliation: (params: {
    physicalCountGrade1: number;
    physicalCountGrade2: number;
    actualCashInHand: number;
    notes?: string;
  }) => DailyReconciliation | null;

  // Reset to initial demo seed
  resetToSampleData: () => void;
}

// ----------------------------------------------------------------------------
// Initial Seed Data (Authentic Wakulima Market Scenario)
// ----------------------------------------------------------------------------
const SEED_BATCH_ID = 'batch-wakulima-20261022';
const TODAY_STR = new Date().toISOString().split('T')[0];

const INITIAL_BATCH: TruckBatch = {
  id: SEED_BATCH_ID,
  batchNumber: 'WB-20261022-01',
  truckPlate: 'KDE 421B',
  origin: {
    regionId: 'TZ-NORTH',
    regionName: 'Northern Tanzania (Singida / Karatu / Arusha)',
    specificLocation: 'Singida - Iramba Farm Section B',
    farmerSupplierNotes: 'Well-cured red onions, dry papery skin, very low rot index.'
  },
  arrivalTime: `${TODAY_STR}T05:15:00.000Z`,
  dayNumber: 1,
  nccDeclaredNets: 250,
  nccCessPaid: 17500, // 250 nets * 70 Ksh County cess
  initialGrade1Nets: 180,
  initialGrade2Nets: 70,
  remainingGrade1Nets: 145, // 35 sold so far
  remainingGrade2Nets: 50,  // 20 sold so far
  photoUrls: [
    'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?w=800&auto=format&fit=crop&q=80'
  ],
  qualityNotes: 'Bright ruby skin, high pungency, uniform large bulbs for G1.',
  status: 'ACTIVE',
  createdAt: `${TODAY_STR}T05:00:00.000Z`
};

const INITIAL_EXPENSES: DailyExpense[] = [
  {
    id: 'exp-fixed-watchman-01',
    batchId: SEED_BATCH_ID,
    date: TODAY_STR,
    category: 'WATCHMAN',
    description: 'Overnight bay security watchman fee',
    amount: 100,
    paidVia: 'CASH',
  },
  {
    id: 'exp-fixed-cleaner-01',
    batchId: SEED_BATCH_ID,
    date: TODAY_STR,
    category: 'CLEANER',
    description: 'Mandatory market bay cleaning & sanitation',
    amount: 100,
    paidVia: 'CASH',
  },
  {
    id: 'exp-chai-01',
    batchId: SEED_BATCH_ID,
    date: TODAY_STR,
    category: 'MEALS',
    description: 'Morning chai & mandazi for offloading team',
    amount: 350,
    paidVia: 'CASH',
  }
];

const INITIAL_LABOR: CasualLaborer[] = [
  {
    id: 'lab-01',
    batchId: SEED_BATCH_ID,
    date: TODAY_STR,
    workerName: 'Otieno',
    task: 'OFFLOAD',
    agreedWage: 700,
    isPaid: true,
    paidVia: 'CASH'
  },
  {
    id: 'lab-02',
    batchId: SEED_BATCH_ID,
    date: TODAY_STR,
    workerName: 'Kamau',
    task: 'SORTING',
    agreedWage: 600,
    isPaid: true,
    paidVia: 'CASH'
  },
  {
    id: 'lab-03',
    batchId: SEED_BATCH_ID,
    date: TODAY_STR,
    workerName: 'Wafula',
    task: 'SELLING_HELP',
    agreedWage: 500,
    isPaid: false,
  }
];

const INITIAL_ALLOCATION: SellerAllocation = {
  id: 'alloc-01',
  batchId: SEED_BATCH_ID,
  sellerId: 'usr-seller-juma',
  sellerName: 'Juma (Sales Assistant)',
  date: TODAY_STR,
  grade1Allocated: 50,
  grade2Allocated: 30,
  expectedPriceG1: 2600,
  expectedPriceG2: 2100,
  grade1Sold: 20,
  grade2Sold: 10
};

const INITIAL_SALES: SaleTransaction[] = [
  {
    id: 'sale-001',
    batchId: SEED_BATCH_ID,
    sellerId: 'usr-merchant-01',
    timestamp: `${TODAY_STR}T06:30:00.000Z`,
    grade: 'GRADE_1',
    quantityNets: 15,
    negotiatedUnitPrice: 2600,
    totalAmount: 39000,
    paymentMethod: 'MPESA',
    mpesaReceiptCode: 'QJK891M3KL',
    buyerName: 'Mama Njoroge Grocers',
    buyerPhone: '+254722112233'
  },
  {
    id: 'sale-002',
    batchId: SEED_BATCH_ID,
    sellerId: 'usr-seller-juma',
    timestamp: `${TODAY_STR}T07:15:00.000Z`,
    grade: 'GRADE_1',
    quantityNets: 20,
    negotiatedUnitPrice: 2550, // Negotiated slightly down from 2600
    totalAmount: 51000,
    paymentMethod: 'CASH',
    buyerName: 'City Market Wholesale Buyer',
    buyerPhone: '+254733445566'
  },
  {
    id: 'sale-003',
    batchId: SEED_BATCH_ID,
    sellerId: 'usr-seller-juma',
    timestamp: `${TODAY_STR}T08:00:00.000Z`,
    grade: 'GRADE_2',
    quantityNets: 10,
    negotiatedUnitPrice: 2050,
    totalAmount: 20500,
    paymentMethod: 'CASH',
    buyerName: 'Auntie Wambui Vibanda',
    buyerPhone: '+254711998877'
  },
  {
    id: 'sale-004',
    batchId: SEED_BATCH_ID,
    sellerId: 'usr-merchant-01',
    timestamp: `${TODAY_STR}T09:10:00.000Z`,
    grade: 'GRADE_2',
    quantityNets: 10,
    negotiatedUnitPrice: 2100,
    totalAmount: 21000,
    paymentMethod: 'CREDIT',
    buyerName: 'Kariokor Hotel Supplies',
    buyerPhone: '+254799001122',
    creditRecordId: 'cred-entry-001'
  }
];

const INITIAL_CUSTOMER_CREDITS: CustomerCredit[] = [
  {
    id: 'cust-cred-01',
    customerName: 'Kariokor Hotel Supplies',
    customerPhone: '+254799001122',
    marketingConsent: true,
    totalOutstandingCredit: 21000,
    records: [
      {
        id: 'cred-entry-001',
        saleId: 'sale-004',
        batchId: SEED_BATCH_ID,
        dateIssued: TODAY_STR,
        grade: 'GRADE_2',
        quantityNets: 10,
        totalOwed: 21000,
        amountPaid: 0,
        status: 'OUTSTANDING',
        dueDate: '2026-10-25',
        repayments: []
      }
    ]
  },
  {
    id: 'cust-cred-02',
    customerName: 'Muthurwa Super Fast Food',
    customerPhone: '+254720987654',
    marketingConsent: true,
    totalOutstandingCredit: 12500,
    records: [
      {
        id: 'cred-entry-past-01',
        saleId: 'sale-past-99',
        batchId: 'batch-previous-week',
        dateIssued: '2026-10-20',
        grade: 'GRADE_1',
        quantityNets: 5,
        totalOwed: 12500,
        amountPaid: 5000,
        status: 'PARTIAL',
        dueDate: '2026-10-23',
        repayments: [
          {
            id: 'rep-001',
            creditEntryId: 'cred-entry-past-01',
            timestamp: `${TODAY_STR}T10:00:00.000Z`,
            amountPaid: 5000,
            paymentMethod: 'MPESA',
            mpesaReceiptCode: 'QJK9923KPP',
            collectedBy: 'Main Merchant (Admin)'
          }
        ]
      }
    ]
  }
];

const INITIAL_REPAYMENTS: CreditRepayment[] = [
  {
    id: 'rep-001',
    creditEntryId: 'cred-entry-past-01',
    timestamp: `${TODAY_STR}T10:00:00.000Z`,
    amountPaid: 5000,
    paymentMethod: 'MPESA',
    mpesaReceiptCode: 'QJK9923KPP',
    collectedBy: 'Main Merchant (Admin)'
  }
];

export const useAppStore = create<AppState>((set, get) => ({
  // Session & Auth
  role: 'MERCHANT',
  currentUserId: 'usr-merchant-01',
  currentUserName: 'Main Merchant (Admin)',
  currentUserPhone: '+254712345678',
  isAuthenticated: true,

  // Security
  isLockedDown: false,
  lockdownReason: undefined,

  // Data
  currentBatch: INITIAL_BATCH,
  historicalBatches: [],
  allocations: [INITIAL_ALLOCATION],
  sales: INITIAL_SALES,
  expenses: INITIAL_EXPENSES,
  casualLaborers: INITIAL_LABOR,
  customerCredits: INITIAL_CUSTOMER_CREDITS,
  creditRepayments: INITIAL_REPAYMENTS,
  reconciliations: [],

  setRole: (role: UserRole) => {
    if (get().isLockedDown) return;
    set({
      role,
      currentUserName: role === 'MERCHANT' ? 'Main Merchant (Admin)' : 'Juma (Sales Assistant)',
      currentUserPhone: role === 'MERCHANT' ? '+254712345678' : '+254799887766'
    });
  },

  requestLoginOtp: (phone: string, role: UserRole, name: string) => {
    return requestSmsOtp(phone, role, name);
  },

  verifyLoginOtp: (otp: string) => {
    const result = verifySmsOtp(otp);
    if (result.success && result.role) {
      set({
        isAuthenticated: true,
        role: result.role,
        currentUserName: result.role === 'MERCHANT' ? 'Main Merchant (Admin)' : 'Hired Seller',
      });
    } else if (!result.success && get().isLockedDown) {
      set({ isLockedDown: true, lockdownReason: 'Excessive failed OTP attempts.' });
    }
    return result;
  },

  logout: () => {
    set({ isAuthenticated: false });
  },

  lockdown: (reason: string) => {
    triggerSecurityLockdown(reason);
    set({ isLockedDown: true, lockdownReason: reason });
  },

  unlock: (masterKey: string) => {
    const res = unlockSystemWithMasterKey(masterKey);
    if (res.success) {
      set({ isLockedDown: false, lockdownReason: undefined, role: 'MERCHANT' });
    }
    return res;
  },

  createBatch: (params) => {
    const today = new Date().toISOString().split('T')[0];
    const newBatch: TruckBatch = {
      id: `batch-${Date.now()}`,
      batchNumber: `WB-${today.replace(/-/g, '')}-0${get().historicalBatches.length + 1}`,
      truckPlate: params.truckPlate.toUpperCase().trim(),
      origin: params.origin,
      arrivalTime: new Date().toISOString(),
      dayNumber: 1,
      nccDeclaredNets: params.nccDeclaredNets,
      nccCessPaid: params.nccCessPaid,
      initialGrade1Nets: params.initialGrade1Nets,
      initialGrade2Nets: params.initialGrade2Nets,
      remainingGrade1Nets: params.initialGrade1Nets,
      remainingGrade2Nets: params.initialGrade2Nets,
      photoUrls: params.photoUrls,
      qualityNotes: params.qualityNotes,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    // Auto-create fixed daily overhead expenses (Watchman: 100 Ksh, Cleaner: 100 Ksh)
    const fixedExpenses: DailyExpense[] = [
      {
        id: `exp-watchman-${Date.now()}`,
        batchId: newBatch.id,
        date: today,
        category: 'WATCHMAN',
        description: 'Overnight bay watchman security fee',
        amount: MARKET_CONFIG.fixedDailyFees.watchman,
        paidVia: 'CASH'
      },
      {
        id: `exp-cleaner-${Date.now()}`,
        batchId: newBatch.id,
        date: today,
        category: 'CLEANER',
        description: 'Mandatory market bay cleaning & sanitation',
        amount: MARKET_CONFIG.fixedDailyFees.cleaner,
        paidVia: 'CASH'
      }
    ];

    set(state => ({
      currentBatch: newBatch,
      expenses: [...state.expenses, ...fixedExpenses],
    }));
  },

  advanceBatchDay: () => {
    const current = get().currentBatch;
    if (!current || current.dayNumber >= MARKET_CONFIG.maxTruckStayDays) return;

    const nextDay = current.dayNumber + 1;
    const demurrage = calculateDemurrageFee(nextDay);
    const today = new Date().toISOString().split('T')[0];

    // Add demurrage expense if > Day 1
    const demurrageExp: DailyExpense = {
      id: `exp-demurrage-day${nextDay}-${Date.now()}`,
      batchId: current.id,
      date: today,
      category: 'DEMURRAGE',
      description: `Wakulima Market Day ${nextDay} Truck Demurrage Fee`,
      amount: MARKET_CONFIG.demurrageRatePerConsecutiveDay,
      paidVia: 'CASH'
    };

    // Auto-append daily security + cleaner
    const dailyFixed: DailyExpense[] = [
      {
        id: `exp-watchman-day${nextDay}-${Date.now()}`,
        batchId: current.id,
        date: today,
        category: 'WATCHMAN',
        description: `Day ${nextDay} Overnight watchman security`,
        amount: MARKET_CONFIG.fixedDailyFees.watchman,
        paidVia: 'CASH'
      },
      {
        id: `exp-cleaner-day${nextDay}-${Date.now()}`,
        batchId: current.id,
        date: today,
        category: 'CLEANER',
        description: `Day ${nextDay} Market bay cleaning fee`,
        amount: MARKET_CONFIG.fixedDailyFees.cleaner,
        paidVia: 'CASH'
      }
    ];

    set(state => ({
      currentBatch: state.currentBatch ? {
        ...state.currentBatch,
        dayNumber: nextDay
      } : null,
      expenses: [...state.expenses, demurrageExp, ...dailyFixed]
    }));
  },

  closeCurrentBatch: () => {
    const current = get().currentBatch;
    if (!current) return;

    const closed = {
      ...current,
      status: 'CLOSED' as const,
      closedAt: new Date().toISOString()
    };

    set(state => ({
      currentBatch: null,
      historicalBatches: [closed, ...state.historicalBatches]
    }));
  },

  allocateStockToSeller: (params) => {
    const current = get().currentBatch;
    if (!current) return;

    const newAllocation: SellerAllocation = {
      id: `alloc-${Date.now()}`,
      batchId: current.id,
      sellerId: params.sellerId,
      sellerName: params.sellerName,
      date: new Date().toISOString().split('T')[0],
      grade1Allocated: params.grade1Allocated,
      grade2Allocated: params.grade2Allocated,
      expectedPriceG1: params.expectedPriceG1,
      expectedPriceG2: params.expectedPriceG2,
      grade1Sold: 0,
      grade2Sold: 0
    };

    set(state => ({
      allocations: [...state.allocations, newAllocation]
    }));
  },

  recordSale: (params) => {
    const { currentBatch, role, currentUserId } = get();
    if (!currentBatch) {
      return { success: false, message: 'No active truck batch loaded.' };
    }

    // Check available stock
    const isG1 = params.grade === 'GRADE_1';
    const available = isG1 ? currentBatch.remainingGrade1Nets : currentBatch.remainingGrade2Nets;
    if (params.quantityNets > available) {
      return {
        success: false,
        message: `Insufficient stock! Only ${available} nets of ${isG1 ? 'Grade 1' : 'Grade 2'} remaining.`
      };
    }

    const saleId = `sale-${Date.now()}`;
    const totalAmount = params.quantityNets * params.negotiatedUnitPrice;
    let creditRecordId: string | undefined = undefined;

    // Handle Credit transaction
    if (params.paymentMethod === 'CREDIT') {
      creditRecordId = `cred-entry-${Date.now()}`;
      const customerName = params.buyerName || 'Valued Regular Buyer';
      const customerPhone = params.buyerPhone || '+254700000000';

      const newCreditEntry = {
        id: creditRecordId,
        saleId,
        batchId: currentBatch.id,
        dateIssued: new Date().toISOString().split('T')[0],
        grade: params.grade,
        quantityNets: params.quantityNets,
        totalOwed: totalAmount,
        amountPaid: 0,
        status: 'OUTSTANDING' as const,
        repayments: []
      };

      set(state => {
        const existingCustIdx = state.customerCredits.findIndex(
          c => c.customerPhone === customerPhone || c.customerName.toLowerCase() === customerName.toLowerCase()
        );

        if (existingCustIdx >= 0) {
          const updated = [...state.customerCredits];
          updated[existingCustIdx].totalOutstandingCredit += totalAmount;
          updated[existingCustIdx].records.push(newCreditEntry);
          return { customerCredits: updated };
        } else {
          const newCustomer: CustomerCredit = {
            id: `cust-cred-${Date.now()}`,
            customerName,
            customerPhone,
            marketingConsent: true,
            totalOutstandingCredit: totalAmount,
            records: [newCreditEntry]
          };
          return { customerCredits: [...state.customerCredits, newCustomer] };
        }
      });
    }

    const newSale: SaleTransaction = {
      id: saleId,
      batchId: currentBatch.id,
      sellerId: currentUserId,
      timestamp: new Date().toISOString(),
      grade: params.grade,
      quantityNets: params.quantityNets,
      negotiatedUnitPrice: params.negotiatedUnitPrice,
      totalAmount,
      paymentMethod: params.paymentMethod,
      buyerName: params.buyerName,
      buyerPhone: params.buyerPhone,
      mpesaReceiptCode: params.mpesaReceiptCode,
      creditRecordId
    };

    // Decrement stock in current batch
    set(state => ({
      sales: [newSale, ...state.sales],
      currentBatch: state.currentBatch ? {
        ...state.currentBatch,
        remainingGrade1Nets: isG1 
          ? state.currentBatch.remainingGrade1Nets - params.quantityNets 
          : state.currentBatch.remainingGrade1Nets,
        remainingGrade2Nets: !isG1 
          ? state.currentBatch.remainingGrade2Nets - params.quantityNets 
          : state.currentBatch.remainingGrade2Nets
      } : null
    }));

    return {
      success: true,
      message: `Sale recorded: ${params.quantityNets} nets of ${params.grade === 'GRADE_1' ? 'Grade 1' : 'Grade 2'} @ Ksh ${params.negotiatedUnitPrice}.`
    };
  },

  recordCreditRepayment: (params) => {
    const repaymentId = `rep-${Date.now()}`;
    const repayment: CreditRepayment = {
      id: repaymentId,
      creditEntryId: params.creditEntryId,
      timestamp: new Date().toISOString(),
      amountPaid: params.amount,
      paymentMethod: params.paymentMethod,
      mpesaReceiptCode: params.mpesaReceiptCode,
      collectedBy: get().currentUserName
    };

    set(state => {
      const updatedCustomers = state.customerCredits.map(cust => {
        if (cust.id === params.customerId) {
          const updatedRecords = cust.records.map(rec => {
            if (rec.id === params.creditEntryId) {
              const newAmountPaid = rec.amountPaid + params.amount;
              const newStatus = newAmountPaid >= rec.totalOwed 
                ? ('SETTLED' as const) 
                : ('PARTIAL' as const);

              return {
                ...rec,
                amountPaid: newAmountPaid,
                status: newStatus,
                repayments: [...rec.repayments, repayment]
              };
            }
            return rec;
          });

          const newTotalOutstanding = Math.max(0, cust.totalOutstandingCredit - params.amount);
          return {
            ...cust,
            totalOutstandingCredit: newTotalOutstanding,
            records: updatedRecords
          };
        }
        return cust;
      });

      return {
        customerCredits: updatedCustomers,
        creditRepayments: [repayment, ...state.creditRepayments]
      };
    });
  },

  addDailyExpense: (params) => {
    const current = get().currentBatch;
    if (!current) return;

    const newExpense: DailyExpense = {
      id: `exp-${Date.now()}`,
      batchId: current.id,
      date: new Date().toISOString().split('T')[0],
      category: params.category,
      description: params.description,
      amount: params.amount,
      paidVia: params.paidVia,
      receiptRef: params.receiptRef
    };

    set(state => ({
      expenses: [newExpense, ...state.expenses]
    }));
  },

  addCasualLaborer: (params) => {
    const current = get().currentBatch;
    if (!current) return;

    const newLaborer: CasualLaborer = {
      id: `lab-${Date.now()}`,
      batchId: current.id,
      date: new Date().toISOString().split('T')[0],
      workerName: params.workerName.trim(),
      task: params.task,
      agreedWage: params.agreedWage,
      isPaid: params.isPaid,
      paidVia: params.paidVia
    };

    set(state => ({
      casualLaborers: [...state.casualLaborers, newLaborer]
    }));
  },

  markLaborerPaid: (laborerId: string, paidVia: 'CASH' | 'MPESA') => {
    set(state => ({
      casualLaborers: state.casualLaborers.map(l => 
        l.id === laborerId ? { ...l, isPaid: true, paidVia } : l
      )
    }));
  },

  performCobReconciliation: (params) => {
    const current = get().currentBatch;
    if (!current) return null;

    const today = new Date().toISOString().split('T')[0];
    const salesToday = get().sales.filter(s => s.batchId === current.id && s.timestamp.startsWith(today));
    const expensesToday = get().expenses.filter(e => e.batchId === current.id && e.date === today);
    const laborToday = get().casualLaborers.filter(l => l.batchId === current.id && l.date === today);
    const repaymentsToday = get().creditRepayments.filter(r => r.timestamp.startsWith(today));

    const reconciliation = calculateDailyReconciliation({
      batch: current,
      salesToday,
      expensesToday,
      casualLaborToday: laborToday,
      creditRepaymentsToday: repaymentsToday,
      physicalCountGrade1: params.physicalCountGrade1,
      physicalCountGrade2: params.physicalCountGrade2,
      actualCashInHand: params.actualCashInHand,
      reconciledBy: get().currentUserName,
      notes: params.notes
    });

    set(state => ({
      reconciliations: [reconciliation, ...state.reconciliations]
    }));

    return reconciliation;
  },

  resetToSampleData: () => {
    set({
      role: 'MERCHANT',
      currentUserId: 'usr-merchant-01',
      currentUserName: 'Main Merchant (Admin)',
      currentUserPhone: '+254712345678',
      isAuthenticated: true,
      isLockedDown: false,
      lockdownReason: undefined,
      currentBatch: INITIAL_BATCH,
      historicalBatches: [],
      allocations: [INITIAL_ALLOCATION],
      sales: INITIAL_SALES,
      expenses: INITIAL_EXPENSES,
      casualLaborers: INITIAL_LABOR,
      customerCredits: INITIAL_CUSTOMER_CREDITS,
      creditRepayments: INITIAL_REPAYMENTS,
      reconciliations: []
    });
  }
}));
