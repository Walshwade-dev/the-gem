import { 
  TruckBatch, 
  SaleTransaction, 
  DailyExpense, 
  CasualLaborer, 
  CreditRepayment, 
  DailyReconciliation 
} from '../types';
import { MARKET_CONFIG } from '../constants/config';

export interface ReconciliationInputs {
  batch: TruckBatch;
  salesToday: SaleTransaction[];
  expensesToday: DailyExpense[];
  casualLaborToday: CasualLaborer[];
  creditRepaymentsToday: CreditRepayment[];
  physicalCountGrade1: number;
  physicalCountGrade2: number;
  actualCashInHand: number;
  reconciledBy: string;
  notes?: string;
}

/**
 * Executes the 14:00 PM Close of Business (COB) Reconciliation
 * Pure domain logic: reconciles physical stock count and financial drawers.
 */
export function calculateDailyReconciliation(inputs: ReconciliationInputs): DailyReconciliation {
  const {
    batch,
    salesToday,
    expensesToday,
    casualLaborToday,
    creditRepaymentsToday,
    physicalCountGrade1,
    physicalCountGrade2,
    actualCashInHand,
    reconciledBy,
    notes,
  } = inputs;

  // 1. Stock Sales Quantities
  const grade1SoldToday = salesToday
    .filter(s => s.grade === 'GRADE_1')
    .reduce((sum, s) => sum + s.quantityNets, 0);

  const grade2SoldToday = salesToday
    .filter(s => s.grade === 'GRADE_2')
    .reduce((sum, s) => sum + s.quantityNets, 0);

  // Expected Remaining Stock
  const expectedRemainingGrade1 = Math.max(0, batch.initialGrade1Nets - grade1SoldToday);
  const expectedRemainingGrade2 = Math.max(0, batch.initialGrade2Nets - grade2SoldToday);

  // Variances (Negative means bags missing, rotten, spoiled, or stolen)
  const varianceGrade1 = physicalCountGrade1 - expectedRemainingGrade1;
  const varianceGrade2 = physicalCountGrade2 - expectedRemainingGrade2;

  // 2. Financial Drawer Reconciliation - Cash
  const cashSalesToday = salesToday
    .filter(s => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const cashCreditRepaymentsToday = creditRepaymentsToday
    .filter(r => r.paymentMethod === 'CASH')
    .reduce((sum, r) => sum + r.amountPaid, 0);

  const cashExpensesToday = expensesToday
    .filter(e => e.paidVia === 'CASH')
    .reduce((sum, e) => sum + e.amount, 0);

  const cashCasualLaborToday = casualLaborToday
    .filter(l => l.isPaid && l.paidVia === 'CASH')
    .reduce((sum, l) => sum + l.agreedWage, 0);

  const expectedCashInHand = cashSalesToday + cashCreditRepaymentsToday - (cashExpensesToday + cashCasualLaborToday);
  const cashDiscrepancy = actualCashInHand - expectedCashInHand;

  // 3. Financial Drawer Reconciliation - M-Pesa
  const mpesaSalesToday = salesToday
    .filter(s => s.paymentMethod === 'MPESA')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const mpesaCreditRepaymentsToday = creditRepaymentsToday
    .filter(r => r.paymentMethod === 'MPESA')
    .reduce((sum, r) => sum + r.amountPaid, 0);

  const mpesaExpensesToday = expensesToday
    .filter(e => e.paidVia === 'MPESA')
    .reduce((sum, e) => sum + e.amount, 0);

  const mpesaCasualLaborToday = casualLaborToday
    .filter(l => l.isPaid && l.paidVia === 'MPESA')
    .reduce((sum, l) => sum + l.agreedWage, 0);

  const expectedMpesaWallet = mpesaSalesToday + mpesaCreditRepaymentsToday - (mpesaExpensesToday + mpesaCasualLaborToday);

  // 4. Credit Extended
  const totalCreditExtendedToday = salesToday
    .filter(s => s.paymentMethod === 'CREDIT')
    .reduce((sum, s) => sum + s.totalAmount, 0);

  // Status check
  let status: 'BALANCED' | 'DISCREPANCY' | 'AUDIT_FLAGGED' = 'BALANCED';
  if (Math.abs(cashDiscrepancy) > 50 || varianceGrade1 !== 0 || varianceGrade2 !== 0) {
    status = 'DISCREPANCY';
  }
  if (Math.abs(cashDiscrepancy) > 2000 || varianceGrade1 < -3 || varianceGrade2 < -3) {
    status = 'AUDIT_FLAGGED';
  }

  const todayIso = new Date().toISOString().split('T')[0];

  return {
    id: `REC-${Date.now()}`,
    batchId: batch.id,
    date: todayIso,
    cobTimestamp: new Date().toISOString(),
    physicalCountGrade1,
    physicalCountGrade2,
    expectedRemainingGrade1,
    expectedRemainingGrade2,
    varianceGrade1,
    varianceGrade2,
    cashSalesToday,
    cashCreditRepaymentsToday,
    cashExpensesPaidToday: cashExpensesToday + cashCasualLaborToday,
    expectedCashInHand,
    actualCashInHand,
    cashDiscrepancy,
    mpesaSalesToday,
    mpesaCreditRepaymentsToday,
    mpesaExpensesPaidToday: mpesaExpensesToday + mpesaCasualLaborToday,
    expectedMpesaWallet,
    totalCreditExtendedToday,
    reconciledBy,
    notes,
    status
  };
}

/**
 * Calculates demurrage fee for a truck based on current day number
 */
export function calculateDemurrageFee(dayNumber: number): number {
  if (dayNumber <= 1) return 0;
  return (dayNumber - 1) * MARKET_CONFIG.demurrageRatePerConsecutiveDay;
}
