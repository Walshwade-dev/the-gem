import { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import {
  assignmentDailyAcknowledgments,
  batchProducts,
  buyers,
  casualLaborers,
  creditEntries,
  dailyExpenses,
  dailyReconciliations,
  expenseCategories,
  liabilityEntries,
  marketSessions,
  masters,
  payments,
  priceApprovals,
  sales,
  salespeople,
  securityEvents,
  securityLockdowns,
  stockAssignments,
  truckBatches,
  varianceCases,
  weighSamples,
} from '../db/schema.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { getNairobiBusinessDate } from '../utils/time.js';
import { getAssignmentAvailableNominalGrams, getBatchPoolNominalGrams } from '../services/stockLedger.js';
import { AppRouteDeps } from './types.js';

export async function registerSyncRoutes(app: FastifyInstance, deps: AppRouteDeps) {
  const { db, config, clerkVerifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  app.get('/sync', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const today = getNairobiBusinessDate();

    const [
      masterRows,
      batchesRaw,
      assignmentsRaw,
      sellers,
      salesRows,
      creditRows,
      paymentRows,
      buyerRows,
      expenseRows,
      categoryRows,
      laborerRows,
      productRows,
      reconciliationRows,
      acknowledgmentRows,
      approvalRows,
      varianceRows,
      liabilityRows,
      weighSampleRows,
      marketSessionRows,
      activeLockdownRows,
      securityEventRows,
    ] = await Promise.all([
      db.select().from(masters).where(eq(masters.id, auth.masterId)).limit(1),
      db
        .select()
        .from(truckBatches)
        .where(eq(truckBatches.masterId, auth.masterId))
        .orderBy(desc(truckBatches.createdAt))
        .limit(50),
      db
        .select()
        .from(stockAssignments)
        .where(
          auth.role === 'MERCHANT'
            ? eq(stockAssignments.masterId, auth.masterId)
            : and(
                eq(stockAssignments.masterId, auth.masterId),
                eq(stockAssignments.salespersonId, auth.userId)
              )
        )
        .orderBy(desc(stockAssignments.openedAt)),
      auth.role === 'MERCHANT'
        ? db
            .select({
              id: salespeople.id,
              masterId: salespeople.masterId,
              phoneE164: salespeople.phoneE164,
              fullName: salespeople.fullName,
              nationalId: salespeople.nationalId,
              status: salespeople.status,
              creditCapNominalGrams: salespeople.creditCapNominalGrams,
              createdAt: salespeople.createdAt,
            })
            .from(salespeople)
            .where(eq(salespeople.masterId, auth.masterId))
        : db
            .select({
              id: salespeople.id,
              masterId: salespeople.masterId,
              phoneE164: salespeople.phoneE164,
              fullName: salespeople.fullName,
              nationalId: salespeople.nationalId,
              status: salespeople.status,
              creditCapNominalGrams: salespeople.creditCapNominalGrams,
              createdAt: salespeople.createdAt,
            })
            .from(salespeople)
            .where(eq(salespeople.id, auth.userId)),
      db
        .select()
        .from(sales)
        .where(
          auth.role === 'MERCHANT'
            ? eq(sales.masterId, auth.masterId)
            : and(
                eq(sales.masterId, auth.masterId),
                eq(sales.sellerType, 'SELLER'),
                eq(sales.sellerId, auth.userId)
              )
        )
        .orderBy(desc(sales.createdAt))
        .limit(200),
      db
        .select()
        .from(creditEntries)
        .where(
          auth.role === 'MERCHANT'
            ? eq(creditEntries.masterId, auth.masterId)
            : and(
                eq(creditEntries.masterId, auth.masterId),
                eq(creditEntries.sellerType, 'SELLER'),
                eq(creditEntries.sellerId, auth.userId)
              )
        )
        .orderBy(desc(creditEntries.createdAt)),
      db
        .select()
        .from(payments)
        .where(eq(payments.masterId, auth.masterId))
        .orderBy(desc(payments.createdAt))
        .limit(200),
      db.select().from(buyers).where(eq(buyers.masterId, auth.masterId)),
      db
        .select()
        .from(dailyExpenses)
        .where(eq(dailyExpenses.masterId, auth.masterId))
        .orderBy(desc(dailyExpenses.createdAt))
        .limit(200),
      db.select().from(expenseCategories).where(eq(expenseCategories.masterId, auth.masterId)),
      auth.role === 'MERCHANT'
        ? db
            .select()
            .from(casualLaborers)
            .where(eq(casualLaborers.masterId, auth.masterId))
            .orderBy(desc(casualLaborers.createdAt))
        : Promise.resolve([]),
      db
        .select()
        .from(batchProducts)
        .where(eq(batchProducts.masterId, auth.masterId))
        .orderBy(desc(batchProducts.createdAt)),
      db
        .select()
        .from(dailyReconciliations)
        .where(eq(dailyReconciliations.masterId, auth.masterId))
        .orderBy(desc(dailyReconciliations.createdAt))
        .limit(100),
      db
        .select()
        .from(assignmentDailyAcknowledgments)
        .where(eq(assignmentDailyAcknowledgments.masterId, auth.masterId))
        .orderBy(desc(assignmentDailyAcknowledgments.businessDate))
        .limit(100),
      auth.role === 'MERCHANT'
        ? db.select().from(priceApprovals).where(eq(priceApprovals.masterId, auth.masterId))
        : Promise.resolve([]),
      db
        .select()
        .from(varianceCases)
        .where(eq(varianceCases.masterId, auth.masterId))
        .orderBy(desc(varianceCases.createdAt))
        .limit(50),
      db
        .select()
        .from(liabilityEntries)
        .where(
          auth.role === 'MERCHANT'
            ? eq(liabilityEntries.masterId, auth.masterId)
            : and(
                eq(liabilityEntries.masterId, auth.masterId),
                eq(liabilityEntries.salespersonId, auth.userId)
              )
        )
        .orderBy(desc(liabilityEntries.createdAt)),
      db
        .select()
        .from(weighSamples)
        .where(eq(weighSamples.masterId, auth.masterId))
        .orderBy(desc(weighSamples.createdAt))
        .limit(50),
      db
        .select()
        .from(marketSessions)
        .where(
          and(eq(marketSessions.masterId, auth.masterId), eq(marketSessions.businessDate, today))
        )
        .limit(1),
      db
        .select()
        .from(securityLockdowns)
        .where(
          and(eq(securityLockdowns.masterId, auth.masterId), eq(securityLockdowns.isActive, true))
        )
        .limit(1),
      auth.role === 'MERCHANT'
        ? db
            .select()
            .from(securityEvents)
            .where(eq(securityEvents.masterId, auth.masterId))
            .orderBy(desc(securityEvents.createdAt))
            .limit(50)
        : Promise.resolve([]),
    ]);

    const [master] = masterRows;
    const [marketSession] = marketSessionRows;
    const [activeLockdown] = activeLockdownRows;

    const [batches, assignments] = await Promise.all([
      Promise.all(
        batchesRaw.map(async (b) => {
          const [poolG1, poolG2] = await Promise.all([
            getBatchPoolNominalGrams(db, b.id, 'GRADE_1'),
            getBatchPoolNominalGrams(db, b.id, 'GRADE_2'),
          ]);
          return {
            ...(auth.role === 'MERCHANT' ? b : { ...b, purchaseCosts: null }),
            poolGrade1NominalGrams: poolG1,
            poolGrade2NominalGrams: poolG2,
          };
        })
      ),
      Promise.all(
        assignmentsRaw.map(async (a) => {
          const [availableGrade1NominalGrams, availableGrade2NominalGrams] = await Promise.all([
            getAssignmentAvailableNominalGrams(db, a.id, 'GRADE_1'),
            getAssignmentAvailableNominalGrams(db, a.id, 'GRADE_2'),
          ]);
          return {
            ...a,
            availableGrade1NominalGrams,
            availableGrade2NominalGrams,
          };
        })
      ),
    ]);

    return reply.send({
      serverTime: new Date().toISOString(),
      businessDate: today,
      role: auth.role,
      userId: auth.userId,
      master,
      batches,
      assignments,
      sellers,
      sales: salesRows,
      creditEntries: creditRows,
      payments: paymentRows,
      buyers: buyerRows,
      expenses: expenseRows,
      expenseCategories: categoryRows,
      casualLaborers: laborerRows,
      batchProducts: productRows,
      reconciliations: reconciliationRows,
      acknowledgments: acknowledgmentRows,
      priceApprovals: approvalRows,
      varianceCases: varianceRows,
      liabilityEntries: liabilityRows,
      weighSamples: weighSampleRows,
      marketSession: marketSession ?? null,
      isLockedDown: Boolean(activeLockdown),
      securityEvents: securityEventRows,
    });
  });
}
