import { and, desc, eq, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { AppDb } from '../db/pool.js';
import {
  dailyExpenses,
  dailyReconciliations,
  masters,
  payments,
  sales,
  salespeople,
  shrinkageConfig,
  stockAssignments,
  stockMovements,
  truckBatches,
  varianceCases,
  weighSamples,
} from '../db/schema.js';
import {
  calculateBilledAmountCents,
  computeExpectedNetWeightGrams,
} from '../utils/money.js';
import { getAssignmentAvailableNominalGrams, getBatchPoolNominalGrams } from './stockLedger.js';

export interface ReconciliationPreview {
  masterId: string;
  batchId: string;
  assignmentId: string | null;
  responsibleName: string;
  responsibleType: 'MASTER' | 'SELLER';
  responsibleId: string;
  businessDate: string;
  dayNumber: number;
  packagingGrams: number;
  openingG1NominalGrams: number;
  openingG2NominalGrams: number;
  expectedG1NominalGrams: number;
  expectedG2NominalGrams: number;
  soldG1NominalGrams: number;
  soldG2NominalGrams: number;
  expectedPriceG1Cents: number;
  expectedPriceG2Cents: number;
  negotiationDiscountCents: number;
  weightConcessionCents: number;
  sampleAvgWeightG: number | null;
  expectedNetWeightG: number;
  weightCheckFlagged: boolean;
  cashSalesCents: number;
  mpesaSalesCents: number;
  creditSalesCents: number;
  cashRepaymentsCents: number;
  mpesaRepaymentsCents: number;
  cashExpensesCents: number;
  mpesaExpensesCents: number;
  expectedCashCents: number;
  expectedMpesaCents: number;
}

export async function getEffectiveShrinkageConfig(
  db: AppDb,
  masterId: string,
  businessDate: string
): Promise<{ lossPerNetPerDayG: number; floorPerNetG: number; extraTolerancePercent: number }> {
  const [cfg] = await db
    .select()
    .from(shrinkageConfig)
    .where(
      and(
        eq(shrinkageConfig.masterId, masterId),
        lte(shrinkageConfig.effectiveFrom, businessDate),
        or(isNull(shrinkageConfig.effectiveTo), gte(shrinkageConfig.effectiveTo, businessDate))
      )
    )
    .orderBy(desc(shrinkageConfig.effectiveFrom))
    .limit(1);

  return {
    lossPerNetPerDayG: cfg?.lossPerNetPerDayG ?? 200,
    floorPerNetG: cfg?.floorPerNetG ?? 18000,
    extraTolerancePercent: cfg ? Number(cfg.extraTolerancePercent) : 0.5,
  };
}

export async function computeReconciliationPreview(
  db: AppDb,
  params: {
    masterId: string;
    batchId: string;
    assignmentId: string | null;
    businessDate: string;
  }
): Promise<ReconciliationPreview> {
  const { masterId, batchId, assignmentId, businessDate } = params;

  const [batch] = await db
    .select()
    .from(truckBatches)
    .where(and(eq(truckBatches.id, batchId), eq(truckBatches.masterId, masterId)))
    .limit(1);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const [master] = await db
    .select()
    .from(masters)
    .where(eq(masters.id, masterId))
    .limit(1);
  if (!master) {
    throw new Error('Master not found');
  }

  let responsibleName = master.fullName;
  let responsibleType: 'MASTER' | 'SELLER' = 'MASTER';
  let responsibleId = master.id;
  let expectedPriceG1Cents = batch.priceG1Cents ?? 0;
  let expectedPriceG2Cents = batch.priceG2Cents ?? 0;

  let expectedG1NominalGrams = 0;
  let expectedG2NominalGrams = 0;

  if (assignmentId) {
    const [assignment] = await db
      .select()
      .from(stockAssignments)
      .where(and(eq(stockAssignments.id, assignmentId), eq(stockAssignments.masterId, masterId)))
      .limit(1);
    if (!assignment) {
      throw new Error('Assignment not found');
    }
    const [seller] = await db
      .select()
      .from(salespeople)
      .where(eq(salespeople.id, assignment.salespersonId))
      .limit(1);
    responsibleName = seller?.fullName ?? 'Salesperson';
    responsibleType = 'SELLER';
    responsibleId = assignment.salespersonId;
    expectedPriceG1Cents = assignment.expectedPriceG1Cents;
    expectedPriceG2Cents = assignment.expectedPriceG2Cents;

    expectedG1NominalGrams = await getAssignmentAvailableNominalGrams(db, assignmentId, 'GRADE_1');
    expectedG2NominalGrams = await getAssignmentAvailableNominalGrams(db, assignmentId, 'GRADE_2');
  } else {
    expectedG1NominalGrams = await getBatchPoolNominalGrams(db, batchId, 'GRADE_1');
    expectedG2NominalGrams = await getBatchPoolNominalGrams(db, batchId, 'GRADE_2');
  }

  // Confirmed/delivered sales for this scope on businessDate
  const scopeSales = await db
    .select()
    .from(sales)
    .where(
      and(
        eq(sales.masterId, masterId),
        eq(sales.batchId, batchId),
        eq(sales.businessDate, businessDate),
        assignmentId
          ? eq(sales.assignmentId, assignmentId)
          : isNull(sales.assignmentId),
        sql`${sales.status} IN ('CONFIRMED', 'DELIVERED')`
      )
    );

  let soldG1NominalGrams = 0;
  let soldG2NominalGrams = 0;
  let negotiationDiscountCents = 0;
  let weightConcessionCents = 0;
  let cashSalesCents = 0;
  let mpesaSalesCents = 0;
  let creditSalesCents = 0;

  for (const s of scopeSales) {
    if (s.grade === 'GRADE_1') {
      soldG1NominalGrams += s.quantityNominalGrams;
    } else {
      soldG2NominalGrams += s.quantityNominalGrams;
    }

    const listBilled = calculateBilledAmountCents(
      s.listPriceCents,
      s.billedGrams,
      batch.packagingGrams,
      master.roundingRule
    );
    if (listBilled > s.totalAmountCents) {
      negotiationDiscountCents += listBilled - s.totalAmountCents;
    }

    if (s.billedGrams < s.quantityNominalGrams) {
      const nominalValue = calculateBilledAmountCents(
        s.unitPricePerNetCents,
        s.quantityNominalGrams,
        batch.packagingGrams,
        master.roundingRule
      );
      if (nominalValue > s.totalAmountCents) {
        weightConcessionCents += nominalValue - s.totalAmountCents;
      }
    }

    if (s.paymentMode === 'CASH') cashSalesCents += s.totalAmountCents;
    else if (s.paymentMode === 'MPESA') mpesaSalesCents += s.totalAmountCents;
    else if (s.paymentMode === 'CREDIT') creditSalesCents += s.totalAmountCents;
  }

  // Repayments recorded by this person on businessDate
  const scopeRepayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.masterId, masterId),
        eq(payments.businessDate, businessDate),
        isNotNull(payments.creditEntryId),
        eq(payments.recordedByType, responsibleType),
        eq(payments.recordedById, responsibleId)
      )
    );

  let cashRepaymentsCents = 0;
  let mpesaRepaymentsCents = 0;
  for (const p of scopeRepayments) {
    if (p.method === 'CASH') cashRepaymentsCents += p.amountCents;
    else if (p.method === 'MPESA') mpesaRepaymentsCents += p.amountCents;
  }

  // Approved expenses paid by this person on businessDate for this batch
  const scopeExpenses = await db
    .select()
    .from(dailyExpenses)
    .where(
      and(
        eq(dailyExpenses.masterId, masterId),
        eq(dailyExpenses.batchId, batchId),
        eq(dailyExpenses.businessDate, businessDate),
        eq(dailyExpenses.reviewStatus, 'APPROVED'),
        eq(dailyExpenses.isPaid, true),
        eq(dailyExpenses.addedByType, responsibleType),
        eq(dailyExpenses.addedById, responsibleId)
      )
    );

  let cashExpensesCents = 0;
  let mpesaExpensesCents = 0;
  for (const e of scopeExpenses) {
    if (e.paidVia === 'CASH') cashExpensesCents += e.amountCents;
    else if (e.paidVia === 'MPESA') mpesaExpensesCents += e.amountCents;
  }

  // Shrinkage check on weigh samples (never mutates nominal stock)
  const shrinkCfg = await getEffectiveShrinkageConfig(db, masterId, businessDate);
  const daysHeld = Math.max(0, batch.dayNumber - 1);
  const expectedNetWeightG = computeExpectedNetWeightGrams(
    batch.packagingGrams,
    daysHeld,
    shrinkCfg.lossPerNetPerDayG,
    shrinkCfg.floorPerNetG
  );

  const sampleRows = await db
    .select({ sampleWeightG: weighSamples.sampleWeightG })
    .from(weighSamples)
    .where(and(eq(weighSamples.batchId, batchId), eq(weighSamples.sampledDate, businessDate)));

  let sampleAvgWeightG: number | null = null;
  let weightCheckFlagged = false;
  if (sampleRows.length > 0) {
    const sum = sampleRows.reduce((acc, r) => acc + r.sampleWeightG, 0);
    sampleAvgWeightG = Math.round(sum / sampleRows.length);
    const toleranceG = Math.round(expectedNetWeightG * (shrinkCfg.extraTolerancePercent / 100));
    weightCheckFlagged = sampleAvgWeightG < expectedNetWeightG - toleranceG;
  }

  const openingG1NominalGrams = expectedG1NominalGrams + soldG1NominalGrams;
  const openingG2NominalGrams = expectedG2NominalGrams + soldG2NominalGrams;

  return {
    masterId,
    batchId,
    assignmentId,
    responsibleName,
    responsibleType,
    responsibleId,
    businessDate,
    dayNumber: batch.dayNumber,
    packagingGrams: batch.packagingGrams,
    openingG1NominalGrams,
    openingG2NominalGrams,
    expectedG1NominalGrams,
    expectedG2NominalGrams,
    soldG1NominalGrams,
    soldG2NominalGrams,
    expectedPriceG1Cents,
    expectedPriceG2Cents,
    negotiationDiscountCents,
    weightConcessionCents,
    sampleAvgWeightG,
    expectedNetWeightG,
    weightCheckFlagged,
    cashSalesCents,
    mpesaSalesCents,
    creditSalesCents,
    cashRepaymentsCents,
    mpesaRepaymentsCents,
    cashExpensesCents,
    mpesaExpensesCents,
    expectedCashCents: cashSalesCents + cashRepaymentsCents - cashExpensesCents,
    expectedMpesaCents: mpesaSalesCents + mpesaRepaymentsCents - mpesaExpensesCents,
  };
}

export async function createOrSubmitReconciliation(
  db: AppDb,
  params: {
    masterId: string;
    batchId: string;
    assignmentId: string | null;
    businessDate: string;
    physicalG1NominalGrams?: number;
    physicalG2NominalGrams?: number;
    actualCashCents?: number;
    notes?: string;
    status: 'DRAFT' | 'SUBMITTED';
  }
) {
  const preview = await computeReconciliationPreview(db, {
    masterId: params.masterId,
    batchId: params.batchId,
    assignmentId: params.assignmentId,
    businessDate: params.businessDate,
  });

  const varianceG1 =
    params.physicalG1NominalGrams !== undefined
      ? params.physicalG1NominalGrams - preview.expectedG1NominalGrams
      : null;
  const varianceG2 =
    params.physicalG2NominalGrams !== undefined
      ? params.physicalG2NominalGrams - preview.expectedG2NominalGrams
      : null;
  const cashDiscrepancy =
    params.actualCashCents !== undefined
      ? params.actualCashCents - preview.expectedCashCents
      : null;

  const [rec] = await db
    .insert(dailyReconciliations)
    .values({
      masterId: preview.masterId,
      batchId: preview.batchId,
      assignmentId: preview.assignmentId,
      responsibleName: preview.responsibleName,
      businessDate: preview.businessDate,
      dayNumber: preview.dayNumber,
      openingG1NominalGrams: preview.openingG1NominalGrams,
      openingG2NominalGrams: preview.openingG2NominalGrams,
      physicalG1NominalGrams: params.physicalG1NominalGrams ?? null,
      physicalG2NominalGrams: params.physicalG2NominalGrams ?? null,
      expectedG1NominalGrams: preview.expectedG1NominalGrams,
      expectedG2NominalGrams: preview.expectedG2NominalGrams,
      varianceG1NominalGrams: varianceG1,
      varianceG2NominalGrams: varianceG2,
      soldG1NominalGrams: preview.soldG1NominalGrams,
      soldG2NominalGrams: preview.soldG2NominalGrams,
      expectedPriceG1Cents: preview.expectedPriceG1Cents,
      expectedPriceG2Cents: preview.expectedPriceG2Cents,
      negotiationDiscountCents: preview.negotiationDiscountCents,
      weightConcessionCents: preview.weightConcessionCents,
      sampleAvgWeightG: preview.sampleAvgWeightG,
      expectedNetWeightG: preview.expectedNetWeightG,
      weightCheckFlagged: preview.weightCheckFlagged,
      cashSalesCents: preview.cashSalesCents,
      mpesaSalesCents: preview.mpesaSalesCents,
      creditSalesCents: preview.creditSalesCents,
      cashRepaymentsCents: preview.cashRepaymentsCents,
      mpesaRepaymentsCents: preview.mpesaRepaymentsCents,
      cashExpensesCents: preview.cashExpensesCents,
      mpesaExpensesCents: preview.mpesaExpensesCents,
      expectedCashCents: preview.expectedCashCents,
      actualCashCents: params.actualCashCents ?? null,
      cashDiscrepancyCents: cashDiscrepancy,
      expectedMpesaCents: preview.expectedMpesaCents,
      status: params.status,
      notes: params.notes ?? null,
    })
    .returning();

  // Nominal count variance (shortfall) opens a variance_case. Drying NEVER opens a case.
  const shortfallG1 = varianceG1 !== null && varianceG1 < 0 ? -varianceG1 : 0;
  const shortfallG2 = varianceG2 !== null && varianceG2 < 0 ? -varianceG2 : 0;
  const totalShortfall = shortfallG1 + shortfallG2;

  let createdVarianceCase = null;
  if (params.status === 'SUBMITTED' && totalShortfall > 0) {
    const valG1 = calculateBilledAmountCents(
      preview.expectedPriceG1Cents,
      shortfallG1,
      preview.packagingGrams
    );
    const valG2 = calculateBilledAmountCents(
      preview.expectedPriceG2Cents,
      shortfallG2,
      preview.packagingGrams
    );
    const [vc] = await db
      .insert(varianceCases)
      .values({
        masterId: preview.masterId,
        batchId: preview.batchId,
        assignmentId: preview.assignmentId,
        reconciliationId: rec.id,
        responsibleType: preview.responsibleType,
        responsibleId: preview.responsibleId,
        shortfallNominalGrams: totalShortfall,
        estimatedValueCents: valG1 + valG2,
        status: 'OPEN',
      })
      .returning();
    createdVarianceCase = vc;
  }

  return { reconciliation: rec, varianceCase: createdVarianceCase };
}
