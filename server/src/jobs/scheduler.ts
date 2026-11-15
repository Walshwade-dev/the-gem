import PgBoss from 'pg-boss';
import { and, desc, eq, gte, isNull, lt, lte, or } from 'drizzle-orm';
import { AppDb } from '../db/pool.js';
import {
  assignmentDailyAcknowledgments,
  dailyExpenses,
  expenseCategories,
  marketSessions,
  masters,
  nccTariffs,
  priceApprovals,
  recurringDailyExpenses,
  sales,
  stockAssignments,
  truckBatches,
} from '../db/schema.js';
import { processSmsOutbox, SmsProvider } from '../providers/sms.js';
import { createOrSubmitReconciliation } from '../services/reconciliation.js';
import { appendStockMovement, getAssignmentAvailableNominalGrams } from '../services/stockLedger.js';
import { getNairobiBusinessDate } from '../utils/time.js';

/**
 * 00:00 EAT Rollover:
 * - Advances batch day_number
 * - Posts flat Day 2+ NCC fee & recurring daily expenses (watchman, cleaners/sweepers)
 *   ONLY while trucks_departed_at IS NULL
 * - Creates OPENING_CARRYOVER acknowledgments for active assignments
 * - NEVER inserts SHRINKAGE stock movements (shrinkage is derived on read only).
 */
export async function runMidnightRollover(db: AppDb, today = getNairobiBusinessDate()) {
  const activeBatches = await db
    .select()
    .from(truckBatches)
    .where(and(eq(truckBatches.status, 'ACTIVE'), lt(truckBatches.businessDate, today)));

  for (const batch of activeBatches) {
    const nextDay = batch.dayNumber + 1;
    await db
      .update(truckBatches)
      .set({ dayNumber: nextDay, businessDate: today })
      .where(eq(truckBatches.id, batch.id));

    if (!batch.trucksDepartedAt) {
      const [tariff] = await db
        .select()
        .from(nccTariffs)
        .where(
          and(
            eq(nccTariffs.masterId, batch.masterId),
            lte(nccTariffs.effectiveFrom, today),
            or(isNull(nccTariffs.effectiveTo), gte(nccTariffs.effectiveTo, today))
          )
        )
        .orderBy(desc(nccTariffs.effectiveFrom))
        .limit(1);

      const dailyFeeCents = tariff?.dailyFeeCents ?? 100000;
      const maxDays = tariff?.defaultMaxDays ?? 4;

      if (nextDay <= maxDays || batch.isNegotiatedExtension) {
        const [nccCat] = await db
          .select()
          .from(expenseCategories)
          .where(
            and(
              eq(expenseCategories.masterId, batch.masterId),
              eq(expenseCategories.code, 'NCC_CESS')
            )
          )
          .limit(1);
        if (nccCat) {
          await db.insert(dailyExpenses).values({
            masterId: batch.masterId,
            batchId: batch.id,
            categoryId: nccCat.id,
            businessDate: today,
            description: `Day ${nextDay} NCC Market Fee (flat daily rate)`,
            amountCents: dailyFeeCents,
            paidVia: 'CASH',
            isPaid: true,
            reviewStatus: 'APPROVED',
            addedByType: 'SYSTEM',
            addedById: batch.masterId,
          });
        }
      }

      const recExpenses = await db
        .select()
        .from(recurringDailyExpenses)
        .where(
          and(
            eq(recurringDailyExpenses.masterId, batch.masterId),
            eq(recurringDailyExpenses.isActive, true)
          )
        );
      for (const re of recExpenses) {
        const [cat] = await db
          .select()
          .from(expenseCategories)
          .where(
            and(
              eq(expenseCategories.masterId, batch.masterId),
              eq(expenseCategories.code, re.categoryCode)
            )
          )
          .limit(1);
        if (cat) {
          await db.insert(dailyExpenses).values({
            masterId: batch.masterId,
            batchId: batch.id,
            categoryId: cat.id,
            businessDate: today,
            description: `Day ${nextDay} Recurring ${cat.label}`,
            amountCents: re.amountCents,
            paidVia: 'CASH',
            isPaid: true,
            reviewStatus: 'APPROVED',
            addedByType: 'SYSTEM',
            addedById: batch.masterId,
          });
        }
      }
    }

    const activeAssignments = await db
      .select()
      .from(stockAssignments)
      .where(and(eq(stockAssignments.batchId, batch.id), eq(stockAssignments.status, 'ACTIVE')));

    for (const a of activeAssignments) {
      const g1 = await getAssignmentAvailableNominalGrams(db, a.id, 'GRADE_1');
      const g2 = await getAssignmentAvailableNominalGrams(db, a.id, 'GRADE_2');
      if (g1 > 0 || g2 > 0) {
        await db.insert(assignmentDailyAcknowledgments).values({
          masterId: batch.masterId,
          assignmentId: a.id,
          businessDate: today,
          eventType: 'DAILY_OPEN',
          expectedG1NominalGrams: g1,
          expectedG2NominalGrams: g2,
          status: 'PENDING',
        });
      }
    }
  }
}

/**
 * 14:00 EAT Market Close + COB draft reconciliations
 */
export async function runMarketCloseJob(db: AppDb, today = getNairobiBusinessDate()) {
  const allMasters = await db.select({ id: masters.id }).from(masters);
  const now = new Date();

  for (const m of allMasters) {
    const [existing] = await db
      .select()
      .from(marketSessions)
      .where(and(eq(marketSessions.masterId, m.id), eq(marketSessions.businessDate, today)))
      .limit(1);

    if (!existing) {
      await db.insert(marketSessions).values({
        masterId: m.id,
        businessDate: today,
        lateSessionOpen: false,
        closedAt: now,
      });
    } else if (!existing.lateSessionOpen && !existing.closedAt) {
      await db
        .update(marketSessions)
        .set({ closedAt: now })
        .where(eq(marketSessions.id, existing.id));
    }

    const activeBatches = await db
      .select({ id: truckBatches.id })
      .from(truckBatches)
      .where(and(eq(truckBatches.masterId, m.id), eq(truckBatches.status, 'ACTIVE')));

    for (const b of activeBatches) {
      await createOrSubmitReconciliation(db, {
        masterId: m.id,
        batchId: b.id,
        assignmentId: null,
        businessDate: today,
        status: 'DRAFT',
      });

      const activeAssignments = await db
        .select({ id: stockAssignments.id })
        .from(stockAssignments)
        .where(and(eq(stockAssignments.batchId, b.id), eq(stockAssignments.status, 'ACTIVE')));

      for (const a of activeAssignments) {
        await createOrSubmitReconciliation(db, {
          masterId: m.id,
          batchId: b.id,
          assignmentId: a.id,
          businessDate: today,
          status: 'DRAFT',
        });
      }
    }
  }
}

export async function runExpirePendingApprovalsJob(db: AppDb) {
  const now = new Date();
  const expired = await db
    .select()
    .from(priceApprovals)
    .where(and(eq(priceApprovals.status, 'PENDING'), lte(priceApprovals.expiresAt, now)));

  for (const pa of expired) {
    await db.transaction(async (tx) => {
      await tx
        .update(priceApprovals)
        .set({ status: 'EXPIRED', decidedAt: now })
        .where(eq(priceApprovals.id, pa.id));

      const [sale] = await tx
        .update(sales)
        .set({ status: 'EXPIRED' })
        .where(eq(sales.id, pa.saleId))
        .returning();

      if (sale) {
        await appendStockMovement(tx, {
          masterId: sale.masterId,
          batchId: sale.batchId,
          assignmentId: sale.assignmentId,
          grade: sale.grade as 'GRADE_1' | 'GRADE_2',
          movementType: 'RELEASE',
          deltaNominalGrams: sale.quantityNominalGrams,
          referenceId: sale.id,
          actorType: 'SYSTEM',
          actorId: sale.masterId,
        });
      }
    });
  }
}

export async function startScheduler(
  db: AppDb,
  connectionString: string,
  smsProvider: SmsProvider
): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString });
  await boss.start();

  await boss.createQueue('midnight-rollover');
  await boss.createQueue('market-close-1400');
  await boss.createQueue('expire-approvals');
  await boss.createQueue('sms-outbox');

  await boss.schedule('midnight-rollover', '0 0 * * *', {}, { tz: 'Africa/Nairobi' });
  await boss.schedule('market-close-1400', '0 14 * * *', {}, { tz: 'Africa/Nairobi' });
  await boss.schedule('expire-approvals', '*/5 * * * *', {}, { tz: 'Africa/Nairobi' });
  await boss.schedule('sms-outbox', '* * * * *', {}, { tz: 'Africa/Nairobi' });

  await boss.work('midnight-rollover', async () => {
    await runMidnightRollover(db);
  });
  await boss.work('market-close-1400', async () => {
    await runMarketCloseJob(db);
  });
  await boss.work('expire-approvals', async () => {
    await runExpirePendingApprovalsJob(db);
  });
  await boss.work('sms-outbox', async () => {
    await processSmsOutbox(db, smsProvider);
  });

  return boss;
}
