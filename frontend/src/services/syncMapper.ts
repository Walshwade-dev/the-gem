import {
  BatchProduct,
  CasualLaborer,
  CreditEntry,
  CreditRepayment,
  CustomerCredit,
  DailyExpense,
  DailyReconciliation,
  ExpenseCategory,
  ProduceGrade,
  SaleTransaction,
  SellerAllocation,
  StaffActivityLog,
  TruckBatch,
  UserRole,
} from '../types';

export interface BackendSyncPayload {
  serverTime: string;
  businessDate: string;
  role: UserRole;
  userId: string;
  master: {
    id: string;
    clerkUserId: string;
    email: string;
    fullName: string;
    storeName: string;
    phoneE164?: string | null;
    nationalId?: string | null;
    allowByWeightSellers: boolean;
    roundingRule: string;
    creditTermsDays: number;
    policyAcceptedAt?: string | null;
  } | null;
  batches: Array<{
    id: string;
    batchNumber: string;
    truckPlate: string;
    originRegionId?: string | null;
    originRegionName?: string | null;
    originSpecificLocation?: string | null;
    farmerSupplierNotes?: string | null;
    arrivalTime: string;
    dayNumber: number;
    isNegotiatedExtension: boolean;
    packagingGrams: number;
    netsLoaded: number;
    initialGrade1NominalGrams: number;
    initialGrade2NominalGrams: number;
    poolGrade1NominalGrams: number;
    poolGrade2NominalGrams: number;
    nccCountedNets: number;
    nccComputedPayableCents: number;
    nccOfficialAmountCents?: number | null;
    isNccCessPaid: boolean;
    nccCessPaidAt?: string | null;
    priceG1Cents?: number | null;
    minPriceG1Cents?: number | null;
    priceG2Cents?: number | null;
    minPriceG2Cents?: number | null;
    purchaseCosts?: TruckBatch['purchaseCosts'] | null;
    photoUrls: string[];
    qualityNotes?: string | null;
    status: 'ACTIVE' | 'CLOSED' | 'LOCKED';
    createdAt: string;
  }>;
  assignments: Array<{
    id: string;
    batchId: string;
    salespersonId: string;
    expectedPriceG1Cents: number;
    expectedPriceG2Cents: number;
    status: 'ACTIVE' | 'CLOSED' | 'REVOKED';
    openedAt: string;
    closedAt?: string | null;
    availableGrade1NominalGrams: number;
    availableGrade2NominalGrams: number;
  }>;
  sellers: Array<{
    id: string;
    phoneE164: string;
    fullName: string;
    nationalId?: string | null;
    status: string;
    creditCapNominalGrams?: number | null;
  }>;
  sales: Array<{
    id: string;
    batchId: string;
    assignmentId?: string | null;
    sellerType: 'MASTER' | 'SELLER';
    sellerId: string;
    buyerId?: string | null;
    buyerName?: string | null;
    grade: ProduceGrade;
    pricingMode: 'PER_NET' | 'BY_WEIGHT';
    quantityNominalGrams: number;
    weighedGrams: number;
    billedGrams: number;
    unitPricePerNetCents: number;
    totalAmountCents: number;
    paymentMode: 'CASH' | 'MPESA' | 'CREDIT';
    status: string;
    isOfflineSynced: boolean;
    createdAt: string;
  }>;
  creditEntries: Array<{
    id: string;
    saleId: string;
    buyerId: string;
    batchId: string;
    sellerId: string;
    grade: ProduceGrade;
    quantityNominalGrams: number;
    totalOwedCents: number;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    dueDate: string;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    saleId?: string | null;
    creditEntryId?: string | null;
    method: 'CASH' | 'MPESA';
    amountCents: number;
    mpesaReceipt?: string | null;
    recordedById: string;
    createdAt: string;
  }>;
  buyers: Array<{
    id: string;
    fullName: string;
    phoneE164: string;
    nationalId: string;
  }>;
  expenses: Array<{
    id: string;
    batchId: string;
    categoryId: string;
    businessDate: string;
    description: string;
    amountCents: number;
    paidVia: 'CASH' | 'MPESA';
    receiptRef?: string | null;
    isPaid: boolean;
    addedById: string;
    createdAt: string;
  }>;
  expenseCategories: Array<{
    id: string;
    code: string;
    label: string;
  }>;
  casualLaborers: Array<{
    id: string;
    batchId: string;
    workerName: string;
    task: CasualLaborer['task'];
    agreedWageCents: number;
    isPaid: boolean;
    paidVia?: 'CASH' | 'MPESA' | null;
    createdAt: string;
  }>;
  batchProducts: Array<{
    id: string;
    batchId: string;
    title: string;
    grade: ProduceGrade;
    packaging: BatchProduct['packaging'];
    weightGrams: number;
    priceCents: number;
    minPriceCents: number;
    photoUrl?: string | null;
    photoUrls: string[];
    description?: string | null;
    tags: string[];
  }>;
  reconciliations: Array<{
    id: string;
    batchId: string;
    businessDate: string;
    dayNumber: number;
    openingG1NominalGrams: number;
    openingG2NominalGrams: number;
    physicalG1NominalGrams?: number | null;
    physicalG2NominalGrams?: number | null;
    expectedG1NominalGrams: number;
    expectedG2NominalGrams: number;
    soldG1NominalGrams: number;
    soldG2NominalGrams: number;
    cashSalesCents: number;
    mpesaSalesCents: number;
    creditSalesCents: number;
    cashRepaymentsCents: number;
    mpesaRepaymentsCents: number;
    cashExpensesCents: number;
    mpesaExpensesCents: number;
    expectedCashCents: number;
    actualCashCents?: number | null;
    cashDiscrepancyCents?: number | null;
    expectedMpesaCents: number;
    status: DailyReconciliation['status'];
    masterApprovalStatus: DailyReconciliation['masterApprovalStatus'];
    notes?: string | null;
    createdAt: string;
  }>;
  acknowledgments: Array<{
    id: string;
    assignmentId: string;
    status: string;
    physicalG1NominalGrams?: number | null;
    physicalG2NominalGrams?: number | null;
    expectedG1NominalGrams: number;
    expectedG2NominalGrams: number;
    note?: string | null;
    acknowledgedAt?: string | null;
  }>;
  isLockedDown: boolean;
}

function mapCategoryCode(code?: string): ExpenseCategory {
  switch (code) {
    case 'NCC_CESS':
      return 'NCC_CESS';
    case 'WATCHMAN':
      return 'WATCHMAN';
    case 'CLEANERS_SWEEPERS':
      return 'CLEANER';
    case 'TRANSPORT':
      return 'TRANSPORT';
    case 'CASUAL_LABOR':
      return 'CASUAL_LABOR';
    default:
      return 'OTHER';
  }
}

export function mapSyncPayloadToStore(payload: BackendSyncPayload) {
  const sellerMap = new Map(payload.sellers.map((s) => [s.id, s]));
  const buyerMap = new Map(payload.buyers.map((b) => [b.id, b]));
  const catMap = new Map(payload.expenseCategories.map((c) => [c.id, c]));

  const mappedBatches: TruckBatch[] = payload.batches.map((b) => {
    const pkgGrams = b.packagingGrams || 20000;
    const pkgKg = Math.round(pkgGrams / 1000);
    return {
      id: b.id,
      batchNumber: b.batchNumber,
      truckPlate: b.truckPlate,
      origin: {
        regionId: b.originRegionId ?? 'KE-RIFT',
        regionName: b.originRegionName ?? 'Rift Valley',
        specificLocation: b.originSpecificLocation ?? '',
        farmerSupplierNotes: b.farmerSupplierNotes ?? undefined,
      },
      arrivalTime: b.arrivalTime,
      dayNumber: b.dayNumber,
      isNegotiatedExtension: b.isNegotiatedExtension,
      nccDeclaredNets: b.nccCountedNets,
      nccCessPaid: Math.round((b.nccOfficialAmountCents ?? b.nccComputedPayableCents) / 100),
      isNccCessPaid: b.isNccCessPaid,
      nccCessPaidAt: b.nccCessPaidAt ?? undefined,
      initialGrade1Nets: b.initialGrade1NominalGrams / pkgGrams,
      initialGrade2Nets: b.initialGrade2NominalGrams / pkgGrams,
      remainingGrade1Nets: b.poolGrade1NominalGrams / pkgGrams,
      remainingGrade2Nets: b.poolGrade2NominalGrams / pkgGrams,
      photoUrls: b.photoUrls ?? [],
      qualityNotes: b.qualityNotes ?? undefined,
      purchaseCosts: b.purchaseCosts ?? undefined,
      pricePerBagGrade1: b.priceG1Cents ? Math.round(b.priceG1Cents / 100) : undefined,
      minPriceGrade1: b.minPriceG1Cents ? Math.round(b.minPriceG1Cents / 100) : undefined,
      pricePerBagGrade2: b.priceG2Cents ? Math.round(b.priceG2Cents / 100) : undefined,
      minPriceGrade2: b.minPriceG2Cents ? Math.round(b.minPriceG2Cents / 100) : undefined,
      packagingKg: pkgKg,
      status: b.status,
      createdAt: b.createdAt,
    };
  });

  const currentBatch = mappedBatches.find((b) => b.status === 'ACTIVE') ?? null;
  const historicalBatches = mappedBatches.filter((b) => b.id !== currentBatch?.id);
  const pkgGrams = (currentBatch?.packagingKg ?? 20) * 1000;

  const ackMap = new Map<string, (typeof payload.acknowledgments)[number]>();
  for (const ack of payload.acknowledgments) {
    if (!ackMap.has(ack.assignmentId)) {
      ackMap.set(ack.assignmentId, ack);
    }
  }

  const allocations: SellerAllocation[] = payload.assignments
    .filter((a) => a.status === 'ACTIVE')
    .map((a) => {
      const seller = sellerMap.get(a.salespersonId);
      const ack = ackMap.get(a.id);
      const g1Left = a.availableGrade1NominalGrams / pkgGrams;
      const g2Left = a.availableGrade2NominalGrams / pkgGrams;
      return {
        id: a.id,
        batchId: a.batchId,
        sellerId: a.salespersonId,
        sellerName: seller?.fullName ?? 'Salesperson',
        sellerPhone: seller?.phoneE164 ?? '',
        sellerNationalId: seller?.nationalId ?? undefined,
        date: a.openedAt.slice(0, 10),
        grade1Allocated: g1Left,
        grade2Allocated: g2Left,
        grade1Sold: 0,
        grade2Sold: 0,
        expectedPriceG1: Math.round(a.expectedPriceG1Cents / 100),
        expectedPriceG2: Math.round(a.expectedPriceG2Cents / 100),
        acknowledgmentStatus:
          ack?.status === 'ACKNOWLEDGED' || ack?.status === 'RESOLVED'
            ? 'ACKNOWLEDGED'
            : ack?.status === 'DISCREPANCY'
              ? 'DISCREPANCY'
              : 'PENDING',
        acknowledgedAt: ack?.acknowledgedAt ?? undefined,
        discrepancyNote: ack?.status === 'DISCREPANCY' ? (ack.note ?? undefined) : undefined,
      };
    });

  const paymentBySale = new Map<string, (typeof payload.payments)[number]>();
  for (const p of payload.payments) {
    if (p.saleId) paymentBySale.set(p.saleId, p);
  }

  const mappedSales: SaleTransaction[] = payload.sales.map((s) => {
    const buyer = s.buyerId ? buyerMap.get(s.buyerId) : undefined;
    const pay = paymentBySale.get(s.id);
    const seller = sellerMap.get(s.sellerId);
    return {
      id: s.id,
      batchId: s.batchId,
      sellerId: s.sellerId,
      sellerName:
        s.sellerType === 'MASTER'
          ? (payload.master?.fullName ?? 'Master')
          : (seller?.fullName ?? 'Salesperson'),
      grade: s.grade,
      quantityNets: s.quantityNominalGrams / pkgGrams,
      negotiatedUnitPrice: Math.round(s.unitPricePerNetCents / 100),
      totalAmount: Math.round(s.totalAmountCents / 100),
      paymentMethod: s.paymentMode,
      buyerName: s.buyerName ?? buyer?.fullName,
      buyerPhone: buyer?.phoneE164,
      buyerNationalId: buyer?.nationalId,
      mpesaReceiptCode: pay?.mpesaReceipt ?? undefined,
      isOfflineSynced: s.isOfflineSynced,
      timestamp: s.createdAt,
    };
  });

  const mappedExpenses: DailyExpense[] = payload.expenses.map((e) => {
    const cat = catMap.get(e.categoryId);
    return {
      id: e.id,
      batchId: e.batchId,
      date: e.businessDate,
      category: mapCategoryCode(cat?.code),
      description: e.description,
      amount: Math.round(e.amountCents / 100),
      paidVia: e.paidVia,
      receiptRef: e.receiptRef ?? undefined,
      isPaid: e.isPaid,
    };
  });

  const mappedLaborers: CasualLaborer[] = payload.casualLaborers.map((l) => ({
    id: l.id,
    batchId: l.batchId,
    date: l.createdAt.slice(0, 10),
    workerName: l.workerName,
    task: l.task,
    agreedWage: Math.round(l.agreedWageCents / 100),
    isPaid: l.isPaid,
    paidVia: l.paidVia ?? undefined,
  }));

  const batchMap = new Map(mappedBatches.map((b) => [b.id, b]));
  const creditById = new Map(payload.creditEntries.map((ce) => [ce.id, ce]));

  const repaymentsByCredit = new Map<string, CreditRepayment[]>();
  const mappedRepayments: CreditRepayment[] = [];
  for (const p of payload.payments) {
    if (p.creditEntryId) {
      const ce = creditById.get(p.creditEntryId);
      const b = ce ? batchMap.get(ce.batchId) : undefined;
      const rep: CreditRepayment = {
        id: p.id,
        creditEntryId: p.creditEntryId,
        batchId: ce?.batchId ?? '',
        truckPlate: b?.truckPlate ?? '',
        originRegion: b?.origin.regionName ?? '',
        originSpecificLocation: b?.origin.specificLocation ?? '',
        dateIssued: ce?.createdAt.slice(0, 10) ?? p.createdAt.slice(0, 10),
        authorizedBy: sellerMap.get(ce?.sellerId ?? '')?.fullName ?? payload.master?.fullName ?? 'Master',
        timestamp: p.createdAt,
        amountPaid: Math.round(p.amountCents / 100),
        paymentMethod: p.method,
        mpesaReceiptCode: p.mpesaReceipt ?? undefined,
        collectedBy: p.recordedById,
      };
      mappedRepayments.push(rep);
      const list = repaymentsByCredit.get(p.creditEntryId) ?? [];
      list.push(rep);
      repaymentsByCredit.set(p.creditEntryId, list);
    }
  }

  // Deduplicate credit entries (by saleId or identical buyer/batch/date/grade/quantity/amount/seller)
  const dedupedCreditEntries = new Map<string, (typeof payload.creditEntries)[number]>();
  for (const ce of payload.creditEntries) {
    const key = ce.saleId
      ? `sale:${ce.saleId}`
      : [
          ce.buyerId,
          ce.batchId,
          ce.createdAt.slice(0, 10),
          ce.grade,
          ce.quantityNominalGrams,
          ce.totalOwedCents,
          ce.sellerId,
        ].join('::');

    const existing = dedupedCreditEntries.get(key);
    if (!existing) {
      dedupedCreditEntries.set(key, ce);
    } else {
      const existingReps = repaymentsByCredit.get(existing.id)?.length ?? 0;
      const nextReps = repaymentsByCredit.get(ce.id)?.length ?? 0;
      const existingApproved = existing.approvalStatus === 'APPROVED' ? 1 : 0;
      const nextApproved = ce.approvalStatus === 'APPROVED' ? 1 : 0;
      if (nextReps > existingReps || (nextReps === existingReps && nextApproved > existingApproved)) {
        dedupedCreditEntries.set(key, ce);
      }
    }
  }

  const creditGroup = new Map<string, CustomerCredit>();
  for (const ce of dedupedCreditEntries.values()) {
    const buyer = buyerMap.get(ce.buyerId);
    if (!buyer) continue;
    const reps = repaymentsByCredit.get(ce.id) ?? [];
    const paidKsh = reps.reduce((acc, r) => acc + r.amountPaid, 0);
    const owedKsh = Math.round(ce.totalOwedCents / 100);
    const b = batchMap.get(ce.batchId);
    const entry: CreditEntry = {
      id: ce.id,
      batchId: ce.batchId,
      batchNumber: b?.batchNumber,
      truckPlate: b?.truckPlate ?? '',
      originRegion: b?.origin.regionName ?? '',
      originSpecificLocation: b?.origin.specificLocation ?? '',
      dateIssued: ce.createdAt.slice(0, 10),
      authorizedBy: sellerMap.get(ce.sellerId)?.fullName ?? payload.master?.fullName ?? 'Master',
      saleId: ce.saleId,
      sellerId: ce.sellerId,
      sellerName: sellerMap.get(ce.sellerId)?.fullName ?? payload.master?.fullName ?? 'Staff',
      grade: ce.grade,
      quantityNets: ce.quantityNominalGrams / pkgGrams,
      totalOwed: owedKsh,
      amountPaid: paidKsh,
      status: paidKsh >= owedKsh ? 'SETTLED' : paidKsh > 0 ? 'PARTIAL' : 'OUTSTANDING',
      approvalStatus: ce.approvalStatus,
      dueDate: ce.dueDate,
      repayments: reps,
    };

    const existing = creditGroup.get(buyer.id);
    if (!existing) {
      creditGroup.set(buyer.id, {
        id: buyer.id,
        customerName: buyer.fullName,
        customerPhone: buyer.phoneE164,
        customerNationalId: buyer.nationalId,
        marketingConsent: true,
        totalOutstandingCredit: Math.max(0, owedKsh - paidKsh),
        records: [entry],
      });
    } else {
      existing.totalOutstandingCredit += Math.max(0, owedKsh - paidKsh);
      existing.records.push(entry);
    }
  }

  const mappedProducts: BatchProduct[] = payload.batchProducts.map((p) => {
    const b = batchMap.get(p.batchId);
    return {
      id: p.id,
      batchId: p.batchId,
      title: p.title,
      grade: p.grade,
      packaging: p.packaging,
      weightKg: Math.round(p.weightGrams / 1000),
      pricePerBag: Math.round(p.priceCents / 100),
      minPrice: Math.round(p.minPriceCents / 100),
      availableBags: b ? (p.grade === 'GRADE_1' ? b.remainingGrade1Nets : b.remainingGrade2Nets) : 0,
      origin: b?.origin.regionName ?? 'Market Stock',
      photoUrl: p.photoUrl || p.photoUrls?.[0] || '',
      photoUrls: p.photoUrls ?? [],
      description: p.description ?? undefined,
      tags: p.tags ?? [],
    };
  });

  const mappedReconciliations: DailyReconciliation[] = payload.reconciliations.map((r) => ({
    id: r.id,
    batchId: r.batchId,
    date: r.businessDate,
    dayNumber: r.dayNumber,
    cobTimestamp: r.createdAt,
    openingStockGrade1: r.openingG1NominalGrams / pkgGrams,
    openingStockGrade2: r.openingG2NominalGrams / pkgGrams,
    physicalCountGrade1: (r.physicalG1NominalGrams ?? r.expectedG1NominalGrams) / pkgGrams,
    physicalCountGrade2: (r.physicalG2NominalGrams ?? r.expectedG2NominalGrams) / pkgGrams,
    expectedRemainingGrade1: r.expectedG1NominalGrams / pkgGrams,
    expectedRemainingGrade2: r.expectedG2NominalGrams / pkgGrams,
    varianceGrade1: ((r.physicalG1NominalGrams ?? r.expectedG1NominalGrams) - r.expectedG1NominalGrams) / pkgGrams,
    varianceGrade2: ((r.physicalG2NominalGrams ?? r.expectedG2NominalGrams) - r.expectedG2NominalGrams) / pkgGrams,
    soldGrade1Nets: r.soldG1NominalGrams / pkgGrams,
    soldGrade2Nets: r.soldG2NominalGrams / pkgGrams,
    cashSalesToday: Math.round(r.cashSalesCents / 100),
    mpesaSalesToday: Math.round(r.mpesaSalesCents / 100),
    totalCreditExtendedToday: Math.round(r.creditSalesCents / 100),
    cashCreditRepaymentsToday: Math.round(r.cashRepaymentsCents / 100),
    mpesaCreditRepaymentsToday: Math.round(r.mpesaRepaymentsCents / 100),
    cashExpensesPaidToday: Math.round(r.cashExpensesCents / 100),
    mpesaExpensesPaidToday: Math.round(r.mpesaExpensesCents / 100),
    expectedCashInHand: Math.round(r.expectedCashCents / 100),
    actualCashInHand: Math.round((r.actualCashCents ?? r.expectedCashCents) / 100),
    cashDiscrepancy: Math.round((r.cashDiscrepancyCents ?? 0) / 100),
    expectedMpesaWallet: Math.round(r.expectedMpesaCents / 100),
    reconciledBy: payload.master?.fullName ?? 'Master',
    status: r.status === 'DISCREPANCY' || r.status === 'AUDIT_FLAGGED' ? r.status : 'BALANCED',
    masterApprovalStatus: r.masterApprovalStatus,
    notes: r.notes ?? undefined,
  }));

  const currentSeller = payload.role === 'SELLER' ? sellerMap.get(payload.userId) : undefined;
  const activityLogs: StaffActivityLog[] = [];

  return {
    role: payload.role,
    currentUserId: payload.userId,
    currentUserName:
      payload.role === 'MERCHANT'
        ? (payload.master?.fullName ?? 'Master')
        : (currentSeller?.fullName ?? 'Salesperson'),
    masterName: payload.master?.fullName ?? 'Master',
    storeName: payload.master?.storeName ?? 'Onion Store',
    currentUserPhone:
      payload.role === 'MERCHANT'
        ? (payload.master?.phoneE164 ?? '')
        : (currentSeller?.phoneE164 ?? ''),
    currentUserNationalId:
      payload.role === 'MERCHANT'
        ? (payload.master?.nationalId ?? '')
        : (currentSeller?.nationalId ?? ''),
    merchantPolicyAccepted: Boolean(payload.master?.policyAcceptedAt),
    isLockedDown: payload.isLockedDown,
    currentBatch,
    historicalBatches,
    allocations,
    sales: mappedSales,
    expenses: mappedExpenses,
    casualLaborers: mappedLaborers,
    customerCredits: Array.from(creditGroup.values()),
    creditRepayments: mappedRepayments,
    batchProducts: mappedProducts,
    reconciliations: mappedReconciliations,
    activityLogs,
    expenseCategories: payload.expenseCategories,
  };
}
