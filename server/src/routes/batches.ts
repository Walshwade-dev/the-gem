import { FastifyInstance } from 'fastify';
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  batchProducts,
  dailyExpenses,
  expenseCategories,
  nccTariffs,
  sales,
  stockAssignments,
  truckBatches,
  weighSamples,
} from '../db/schema.js';
import { createAuthMiddleware, requireMaster } from '../auth/middleware.js';
import { computeExpectedNetWeightGrams, computeNccPayableCents } from '../utils/money.js';
import { getNairobiBusinessDate } from '../utils/time.js';
import { writeAuditEvent } from '../services/audit.js';
import { withIdempotency } from '../services/idempotency.js';
import { getEffectiveShrinkageConfig } from '../services/reconciliation.js';
import { appendStockMovement, getBatchPoolNominalGrams } from '../services/stockLedger.js';
import { AppRouteDeps, sendValidationError } from './types.js';

export async function registerBatchRoutes(app: FastifyInstance, deps: AppRouteDeps) {
  const { db, config, clerkVerifier, notifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // GET /batches/active
  app.get('/batches/active', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const today = getNairobiBusinessDate();
    const batches = await db
      .select()
      .from(truckBatches)
      .where(and(eq(truckBatches.masterId, auth.masterId), eq(truckBatches.status, 'ACTIVE')))
      .orderBy(desc(truckBatches.createdAt));

    const shrinkCfg = await getEffectiveShrinkageConfig(db, auth.masterId, today);

    const enriched = await Promise.all(
      batches.map(async (b) => {
        const poolG1 = await getBatchPoolNominalGrams(db, b.id, 'GRADE_1');
        const poolG2 = await getBatchPoolNominalGrams(db, b.id, 'GRADE_2');
        const daysHeld = Math.max(0, b.dayNumber - 1);
        const expectedNetWeightG = computeExpectedNetWeightGrams(
          b.packagingGrams,
          daysHeld,
          shrinkCfg.lossPerNetPerDayG,
          shrinkCfg.floorPerNetG
        );
        return {
          ...b,
          poolGrade1NominalGrams: poolG1,
          poolGrade2NominalGrams: poolG2,
          expectedNetWeightG,
        };
      })
    );

    return reply.send({ batches: enriched });
  });

  // POST /batches (Master only, idempotent)
  app.post('/batches', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const parsed = z
      .object({
        batchNumber: z.string().min(1),
        truckPlate: z.string().min(1),
        originRegionId: z.string().optional(),
        originRegionName: z.string().optional(),
        originSpecificLocation: z.string().optional(),
        farmerSupplierNotes: z.string().optional(),
        packagingGrams: z.number().int().positive().default(20000),
        netsLoaded: z.number().int().positive(),
        initialGrade1NominalGrams: z.number().int().min(0),
        initialGrade2NominalGrams: z.number().int().min(0),
        nccCountedNets: z.number().int().min(0),
        nccReceiptNo: z.string().optional(),
        nccOfficialAmountCents: z.number().int().min(0).optional(),
        isNccCessPaid: z.boolean().default(false),
        priceG1Cents: z.number().int().positive().optional(),
        minPriceG1Cents: z.number().int().positive().optional(),
        priceG2Cents: z.number().int().positive().optional(),
        minPriceG2Cents: z.number().int().positive().optional(),
        purchaseCosts: z.record(z.unknown()).optional(),
        photoUrls: z.array(z.string()).default([]),
        qualityNotes: z.string().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const data = parsed.data;
    if (
      data.initialGrade1NominalGrams + data.initialGrade2NominalGrams !==
      data.netsLoaded * data.packagingGrams
    ) {
      return reply.code(400).send({
        error: 'INITIAL_STOCK_MISMATCH',
        message: 'Grade 1 + Grade 2 nominal grams must equal netsLoaded * packagingGrams',
      });
    }

    const idemKey = request.headers['idempotency-key'] as string | undefined;
    const result = await withIdempotency({
      db,
      key: idemKey,
      masterId: auth.masterId,
      actorId: auth.userId,
      route: 'POST /batches',
      requestBody: data,
      handler: async () => {
        const businessDate = getNairobiBusinessDate();
        const created = await db.transaction(async (tx) => {
          let [tariff] = await tx
            .select()
            .from(nccTariffs)
            .where(
              and(
                eq(nccTariffs.masterId, auth.masterId),
                lte(nccTariffs.effectiveFrom, businessDate),
                or(isNull(nccTariffs.effectiveTo), gte(nccTariffs.effectiveTo, businessDate))
              )
            )
            .orderBy(desc(nccTariffs.effectiveFrom))
            .limit(1);

          if (!tariff) {
            [tariff] = await tx
              .insert(nccTariffs)
              .values({
                masterId: auth.masterId,
                ratePerNetCents: 2000,
                discountCents: 200000,
                minPayableCents: 600000,
                dailyFeeCents: 100000,
                defaultMaxDays: 4,
                effectiveFrom: businessDate,
              })
              .returning();
          }

          const nccComputedPayableCents = computeNccPayableCents(
            data.nccCountedNets,
            tariff.ratePerNetCents,
            tariff.discountCents,
            tariff.minPayableCents
          );
          const nccAmountMismatch =
            data.nccOfficialAmountCents !== undefined &&
            data.nccOfficialAmountCents !== nccComputedPayableCents;

          const [batch] = await tx
            .insert(truckBatches)
            .values({
              masterId: auth.masterId,
              batchNumber: data.batchNumber,
              truckPlate: data.truckPlate,
              originRegionId: data.originRegionId ?? null,
              originRegionName: data.originRegionName ?? null,
              originSpecificLocation: data.originSpecificLocation ?? null,
              farmerSupplierNotes: data.farmerSupplierNotes ?? null,
              businessDate,
              dayNumber: 1,
              packagingGrams: data.packagingGrams,
              netsLoaded: data.netsLoaded,
              initialGrade1NominalGrams: data.initialGrade1NominalGrams,
              initialGrade2NominalGrams: data.initialGrade2NominalGrams,
              nccCountedNets: data.nccCountedNets,
              nccTariffId: tariff.id,
              nccComputedPayableCents,
              nccReceiptNo: data.nccReceiptNo ?? null,
              nccOfficialAmountCents: data.nccOfficialAmountCents ?? null,
              nccAmountMismatch,
              isNccCessPaid: data.isNccCessPaid,
              nccCessPaidAt: data.isNccCessPaid ? new Date() : null,
              priceG1Cents: data.priceG1Cents ?? null,
              minPriceG1Cents: data.minPriceG1Cents ?? null,
              priceG2Cents: data.priceG2Cents ?? null,
              minPriceG2Cents: data.minPriceG2Cents ?? null,
              purchaseCosts: data.purchaseCosts ?? null,
              photoUrls: data.photoUrls,
              qualityNotes: data.qualityNotes ?? null,
            })
            .returning();

          if (data.initialGrade1NominalGrams > 0) {
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: batch.id,
              grade: 'GRADE_1',
              movementType: 'LOAD',
              deltaNominalGrams: data.initialGrade1NominalGrams,
              referenceId: batch.id,
              actorType: 'MASTER',
              actorId: auth.userId,
            });
          }
          if (data.initialGrade2NominalGrams > 0) {
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: batch.id,
              grade: 'GRADE_2',
              movementType: 'LOAD',
              deltaNominalGrams: data.initialGrade2NominalGrams,
              referenceId: batch.id,
              actorType: 'MASTER',
              actorId: auth.userId,
            });
          }

          // Auto-create NCC_CESS daily expense
          let [nccCat] = await tx
            .select()
            .from(expenseCategories)
            .where(
              and(
                eq(expenseCategories.masterId, auth.masterId),
                eq(expenseCategories.code, 'NCC_CESS')
              )
            )
            .limit(1);
          if (!nccCat) {
            [nccCat] = await tx
              .insert(expenseCategories)
              .values({
                masterId: auth.masterId,
                code: 'NCC_CESS',
                label: 'NCC Cess & Market Fee',
                isSystem: true,
              })
              .returning();
          }

          await tx.insert(dailyExpenses).values({
            masterId: auth.masterId,
            batchId: batch.id,
            categoryId: nccCat.id,
            businessDate,
            description: `Day 1 NCC Cess (${data.nccCountedNets} counted nets)`,
            amountCents: data.nccOfficialAmountCents ?? nccComputedPayableCents,
            paidVia: 'CASH',
            receiptRef: data.nccReceiptNo ?? null,
            isPaid: data.isNccCessPaid,
            reviewStatus: 'APPROVED',
            addedByType: 'MASTER',
            addedById: auth.userId,
            reviewedBy: auth.userId,
            reviewedAt: new Date(),
          });

          await writeAuditEvent(tx, {
            masterId: auth.masterId,
            actorType: 'MASTER',
            actorId: auth.userId,
            actorRole: 'MERCHANT',
            entityType: 'truck_batch',
            entityId: batch.id,
            action: 'BATCH_CREATED',
            outcome: 'SUCCESS',
            afterState: {
              batchNumber: batch.batchNumber,
              nccComputedPayableCents,
              nccAmountMismatch,
            },
          });

          return batch;
        });

        await notifier.notify({
          type: 'BATCH_CREATED',
          masterId: auth.masterId,
          targetUserType: 'MASTER',
          title: 'Batch Created',
          body: `Batch ${created.batchNumber} (${created.netsLoaded} nets) loaded`,
          data: { type: 'BATCH_CREATED', batchId: created.id },
        });

        return { status: 201, body: { batch: created } };
      },
    });

    return reply.code(result.status).send(result.body);
  });

  // POST /batches/:id/depart (Master only)
  app.post('/batches/:id/depart', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const auth = request.auth!;
    const [updated] = await db
      .update(truckBatches)
      .set({ trucksDepartedAt: new Date() })
      .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, auth.masterId)))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

    await writeAuditEvent(db, {
      masterId: auth.masterId,
      actorType: 'MASTER',
      actorId: auth.userId,
      actorRole: 'MERCHANT',
      entityType: 'truck_batch',
      entityId: id,
      action: 'TRUCK_DEPARTED',
      outcome: 'SUCCESS',
    });

    return reply.send({ batch: updated });
  });

  // POST /batches/:id/close (Master only)
  app.post('/batches/:id/close', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const auth = request.auth!;

    const openAssignments = await db
      .select({ id: stockAssignments.id })
      .from(stockAssignments)
      .where(
        and(
          eq(stockAssignments.batchId, id),
          eq(stockAssignments.masterId, auth.masterId),
          eq(stockAssignments.status, 'ACTIVE')
        )
      )
      .limit(1);
    if (openAssignments.length > 0) {
      return reply.code(409).send({
        error: 'ACTIVE_ASSIGNMENTS_EXIST',
        message: 'Close or revoke all active assignments before closing the batch',
      });
    }

    const [updated] = await db
      .update(truckBatches)
      .set({ status: 'CLOSED', closedAt: new Date() })
      .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, auth.masterId)))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

    return reply.send({ batch: updated });
  });

  // POST /batches/:id/weigh-samples
  app.post('/batches/:id/weigh-samples', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({ sampleWeightG: z.number().int().positive() })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const [batch] = await db
      .select()
      .from(truckBatches)
      .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, auth.masterId)))
      .limit(1);
    if (!batch) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

    const [sample] = await db
      .insert(weighSamples)
      .values({
        masterId: auth.masterId,
        batchId: id,
        sampleWeightG: parsed.data.sampleWeightG,
        sampledDate: getNairobiBusinessDate(),
        sampledByType: auth.actorType,
        sampledById: auth.userId,
      })
      .returning();

    return reply.code(201).send({ sample });
  });

  // PATCH /batches/:id/pricing (Master only)
  app.patch('/batches/:id/pricing', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        priceG1Cents: z.number().int().positive().optional(),
        minPriceG1Cents: z.number().int().positive().optional(),
        priceG2Cents: z.number().int().positive().optional(),
        minPriceG2Cents: z.number().int().positive().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const [updated] = await db
      .update(truckBatches)
      .set(parsed.data)
      .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, request.auth!.masterId)))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

    return reply.send({ batch: updated });
  });

  // PATCH /batches/:id (Master only — edit batch metadata if a mistake was made)
  app.patch('/batches/:id', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        truckPlate: z.string().min(1).optional(),
        originRegionName: z.string().min(1).optional(),
        originSpecificLocation: z.string().optional(),
        qualityNotes: z.string().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const [updated] = await db
      .update(truckBatches)
      .set(parsed.data)
      .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, request.auth!.masterId)))
      .returning();
    if (!updated) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

    return reply.send({ batch: updated });
  });

  // PATCH /batches/:id/purchase-costs (Master only)
  app.patch(
    '/batches/:id/purchase-costs',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z.object({ purchaseCosts: z.record(z.unknown()) }).safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const [updated] = await db
        .update(truckBatches)
        .set({ purchaseCosts: parsed.data.purchaseCosts })
        .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, request.auth!.masterId)))
        .returning();
      if (!updated) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

      return reply.send({ batch: updated });
    }
  );

  // GET /batches/:id/ledger-summary (Master only)
  app.get(
    '/batches/:id/ledger-summary',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;
      const [batch] = await db
        .select()
        .from(truckBatches)
        .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, auth.masterId)))
        .limit(1);
      if (!batch) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

      const poolG1 = await getBatchPoolNominalGrams(db, id, 'GRADE_1');
      const poolG2 = await getBatchPoolNominalGrams(db, id, 'GRADE_2');

      const [salesAgg] = await db
        .select({
          totalRevenueCents: sql<number>`COALESCE(SUM(${sales.totalAmountCents}), 0)::int`,
          totalSoldG1NominalGrams: sql<number>`COALESCE(SUM(CASE WHEN ${sales.grade} = 'GRADE_1' THEN ${sales.quantityNominalGrams} ELSE 0 END), 0)::int`,
          totalSoldG2NominalGrams: sql<number>`COALESCE(SUM(CASE WHEN ${sales.grade} = 'GRADE_2' THEN ${sales.quantityNominalGrams} ELSE 0 END), 0)::int`,
        })
        .from(sales)
        .where(
          and(
            eq(sales.batchId, id),
            eq(sales.masterId, auth.masterId),
            sql`${sales.status} IN ('CONFIRMED', 'DELIVERED')`
          )
        );

      const [expAgg] = await db
        .select({
          totalApprovedExpensesCents: sql<number>`COALESCE(SUM(${dailyExpenses.amountCents}), 0)::int`,
        })
        .from(dailyExpenses)
        .where(
          and(
            eq(dailyExpenses.batchId, id),
            eq(dailyExpenses.masterId, auth.masterId),
            eq(dailyExpenses.reviewStatus, 'APPROVED')
          )
        );

      return reply.send({
        batch,
        poolGrade1NominalGrams: poolG1,
        poolGrade2NominalGrams: poolG2,
        salesSummary: salesAgg,
        expensesSummary: expAgg,
      });
    }
  );

  // Batch Products
  app.get('/batches/:id/products', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const products = await db
      .select()
      .from(batchProducts)
      .where(and(eq(batchProducts.batchId, id), eq(batchProducts.masterId, request.auth!.masterId)));
    return reply.send({ products });
  });

  app.post(
    '/batches/:id/products',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          title: z.string().min(1),
          grade: z.enum(['GRADE_1', 'GRADE_2']),
          packaging: z.string().min(1),
          weightGrams: z.number().int().positive(),
          priceCents: z.number().int().positive(),
          minPriceCents: z.number().int().positive(),
          photoUrl: z.string().optional(),
          photoUrls: z.array(z.string()).default([]),
          description: z.string().optional(),
          tags: z.array(z.string()).default([]),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const [product] = await db
        .insert(batchProducts)
        .values({
          masterId: request.auth!.masterId,
          batchId: id,
          ...parsed.data,
        })
        .returning();
      return reply.code(201).send({ product });
    }
  );

  app.patch('/products/:id', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        title: z.string().min(1).optional(),
        packaging: z.string().min(1).optional(),
        weightGrams: z.number().int().positive().optional(),
        priceCents: z.number().int().positive().optional(),
        minPriceCents: z.number().int().positive().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const [product] = await db
      .update(batchProducts)
      .set(parsed.data)
      .where(and(eq(batchProducts.id, id), eq(batchProducts.masterId, request.auth!.masterId)))
      .returning();
    if (!product) return reply.code(404).send({ error: 'PRODUCT_NOT_FOUND' });

    return reply.send({ product });
  });

  app.delete('/products/:id', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [deleted] = await db
      .delete(batchProducts)
      .where(and(eq(batchProducts.id, id), eq(batchProducts.masterId, request.auth!.masterId)))
      .returning();
    if (!deleted) return reply.code(404).send({ error: 'PRODUCT_NOT_FOUND' });
    return reply.send({ ok: true, id: deleted.id });
  });

  app.post('/batches/:id/ncc-paid', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [batch] = await db
      .select()
      .from(truckBatches)
      .where(and(eq(truckBatches.id, id), eq(truckBatches.masterId, request.auth!.masterId)))
      .limit(1);
    if (!batch) return reply.code(404).send({ error: 'BATCH_NOT_FOUND' });

    const nextPaid = !batch.isNccCessPaid;
    const [updated] = await db
      .update(truckBatches)
      .set({ isNccCessPaid: nextPaid, nccCessPaidAt: nextPaid ? new Date() : null })
      .where(eq(truckBatches.id, id))
      .returning();
    return reply.send({ batch: updated });
  });
}
