import { FastifyInstance } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  auditEvents,
  casualLaborers,
  dailyExpenses,
  dailyReconciliations,
  expenseCategories,
  liabilityEntries,
  marketSessions,
  truckBatches,
  varianceCases,
  varianceDecisions,
  varianceExplanations,
} from '../db/schema.js';
import { createAuthMiddleware, requireMaster } from '../auth/middleware.js';
import { getNairobiBusinessDate } from '../utils/time.js';
import { writeAuditEvent } from '../services/audit.js';
import { computeReconciliationPreview, createOrSubmitReconciliation } from '../services/reconciliation.js';
import { appendStockMovement } from '../services/stockLedger.js';
import { AppRouteDeps, sendValidationError } from './types.js';

export async function registerOperationsRoutes(app: FastifyInstance, deps: AppRouteDeps) {
  const { db, config, clerkVerifier, sseHub } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // Expense Categories
  app.get('/expense-categories', { preHandler: authenticate }, async (request, reply) => {
    const categories = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.masterId, request.auth!.masterId));
    return reply.send({ categories });
  });

  app.post(
    '/expense-categories',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const parsed = z
        .object({ code: z.string().min(2), label: z.string().min(2) })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const [cat] = await db
        .insert(expenseCategories)
        .values({
          masterId: request.auth!.masterId,
          code: parsed.data.code.toUpperCase(),
          label: parsed.data.label,
          isSystem: false,
        })
        .returning();
      return reply.code(201).send({ category: cat });
    }
  );

  // Batch Expenses
  app.get('/batches/:id/expenses', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rows = await db
      .select()
      .from(dailyExpenses)
      .where(
        and(eq(dailyExpenses.batchId, id), eq(dailyExpenses.masterId, request.auth!.masterId))
      )
      .orderBy(desc(dailyExpenses.createdAt));
    return reply.send({ expenses: rows });
  });

  app.post('/batches/:id/expenses', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        categoryId: z.string().uuid(),
        description: z.string().min(1),
        amountCents: z.number().int().positive(),
        paidVia: z.enum(['CASH', 'MPESA']).default('CASH'),
        receiptRef: z.string().optional(),
        isPaid: z.boolean().default(true),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const reviewStatus = auth.role === 'MERCHANT' ? 'APPROVED' : 'UNREVIEWED';

    const [expense] = await db
      .insert(dailyExpenses)
      .values({
        masterId: auth.masterId,
        batchId: id,
        categoryId: parsed.data.categoryId,
        businessDate: getNairobiBusinessDate(),
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        paidVia: parsed.data.paidVia,
        receiptRef: parsed.data.receiptRef ?? null,
        isPaid: parsed.data.isPaid,
        reviewStatus,
        addedByType: auth.actorType,
        addedById: auth.userId,
        reviewedBy: auth.role === 'MERCHANT' ? auth.userId : null,
        reviewedAt: auth.role === 'MERCHANT' ? new Date() : null,
      })
      .returning();

    return reply.code(201).send({ expense });
  });

  app.post(
    '/expenses/:id/review',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({ decision: z.enum(['APPROVED', 'REJECTED']) })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const [updated] = await db
        .update(dailyExpenses)
        .set({
          reviewStatus: parsed.data.decision,
          reviewedBy: auth.userId,
          reviewedAt: new Date(),
        })
        .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.masterId, auth.masterId)))
        .returning();
      if (!updated) return reply.code(404).send({ error: 'EXPENSE_NOT_FOUND' });

      return reply.send({ expense: updated });
    }
  );

  app.post('/expenses/:id/toggle-paid', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [existing] = await db
      .select()
      .from(dailyExpenses)
      .where(and(eq(dailyExpenses.id, id), eq(dailyExpenses.masterId, request.auth!.masterId)))
      .limit(1);
    if (!existing) return reply.code(404).send({ error: 'EXPENSE_NOT_FOUND' });

    const [updated] = await db
      .update(dailyExpenses)
      .set({ isPaid: !existing.isPaid })
      .where(eq(dailyExpenses.id, id))
      .returning();
    return reply.send({ expense: updated });
  });

  // Casual Laborers
  app.post(
    '/batches/:id/laborers',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          workerName: z.string().min(1),
          task: z.string().min(1),
          agreedWageCents: z.number().int().positive(),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const [laborer] = await db
        .insert(casualLaborers)
        .values({
          masterId: request.auth!.masterId,
          batchId: id,
          businessDate: getNairobiBusinessDate(),
          ...parsed.data,
        })
        .returning();
      return reply.code(201).send({ laborer });
    }
  );

  app.post(
    '/laborers/:id/pay',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z.object({ paidVia: z.enum(['CASH', 'MPESA']).default('CASH') }).safeParse(request.body ?? {});
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const [laborer] = await db
        .update(casualLaborers)
        .set({ isPaid: true, paidVia: parsed.data.paidVia })
        .where(and(eq(casualLaborers.id, id), eq(casualLaborers.masterId, request.auth!.masterId)))
        .returning();
      if (!laborer) return reply.code(404).send({ error: 'LABORER_NOT_FOUND' });

      return reply.send({ laborer });
    }
  );

  // Market Sessions (14:00 EAT cutoff & late-session override)
  app.post(
    '/market-sessions/close',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const auth = request.auth!;
      const businessDate = getNairobiBusinessDate();
      const now = new Date();
      const [session] = await db
        .insert(marketSessions)
        .values({
          masterId: auth.masterId,
          businessDate,
          lateSessionOpen: false,
          closedAt: now,
        })
        .onConflictDoUpdate({
          target: [marketSessions.masterId, marketSessions.businessDate],
          set: { lateSessionOpen: false, closedAt: now },
        })
        .returning();
      return reply.send({ marketSession: session });
    }
  );

  app.post(
    '/market-sessions/late-session/open',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const parsed = z
        .object({
          lateReason: z.string().min(3),
          durationMinutes: z.number().int().min(5).max(480).default(120),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const businessDate = getNairobiBusinessDate();
      const lateEndsAt = new Date(Date.now() + parsed.data.durationMinutes * 60 * 1000);
      const [session] = await db
        .insert(marketSessions)
        .values({
          masterId: auth.masterId,
          businessDate,
          lateSessionOpen: true,
          lateReason: parsed.data.lateReason,
          lateEndsAt,
          openedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: [marketSessions.masterId, marketSessions.businessDate],
          set: {
            lateSessionOpen: true,
            lateReason: parsed.data.lateReason,
            lateEndsAt,
            openedBy: auth.userId,
          },
        })
        .returning();
      return reply.send({ marketSession: session });
    }
  );

  app.post(
    '/market-sessions/late-session/close',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const auth = request.auth!;
      const businessDate = getNairobiBusinessDate();
      const [session] = await db
        .update(marketSessions)
        .set({ lateSessionOpen: false, closedAt: new Date() })
        .where(
          and(
            eq(marketSessions.masterId, auth.masterId),
            eq(marketSessions.businessDate, businessDate)
          )
        )
        .returning();
      return reply.send({ marketSession: session ?? null });
    }
  );

  // Daily Reconciliations (Day's Receipt)
  app.get('/reconciliations/preview', { preHandler: authenticate }, async (request, reply) => {
    const query = request.query as { batchId?: string; assignmentId?: string };
    if (!query.batchId) return reply.code(400).send({ error: 'BATCH_ID_REQUIRED' });
    const auth = request.auth!;
    const preview = await computeReconciliationPreview(db, {
      masterId: auth.masterId,
      batchId: query.batchId,
      assignmentId: query.assignmentId || null,
      businessDate: getNairobiBusinessDate(),
    });
    return reply.send({ preview });
  });

  app.get('/reconciliations', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db
      .select()
      .from(dailyReconciliations)
      .where(eq(dailyReconciliations.masterId, auth.masterId))
      .orderBy(desc(dailyReconciliations.createdAt));
    return reply.send({ reconciliations: rows });
  });

  app.post('/reconciliations', { preHandler: authenticate }, async (request, reply) => {
    const parsed = z
      .object({
        batchId: z.string().uuid(),
        assignmentId: z.string().uuid().nullable().optional(),
        physicalG1NominalGrams: z.number().int().min(0),
        physicalG2NominalGrams: z.number().int().min(0),
        actualCashCents: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const businessDate = getNairobiBusinessDate();
    const out = await createOrSubmitReconciliation(db, {
      masterId: auth.masterId,
      batchId: parsed.data.batchId,
      assignmentId: parsed.data.assignmentId ?? null,
      businessDate,
      physicalG1NominalGrams: parsed.data.physicalG1NominalGrams,
      physicalG2NominalGrams: parsed.data.physicalG2NominalGrams,
      actualCashCents: parsed.data.actualCashCents,
      notes: parsed.data.notes,
      status: 'SUBMITTED',
    });

    return reply.code(201).send(out);
  });

  app.post(
    '/reconciliations/:id/approve',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;
      const [updated] = await db
        .update(dailyReconciliations)
        .set({
          masterApprovalStatus: 'APPROVED',
          approvedBy: auth.userId,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(dailyReconciliations.id, id),
            eq(dailyReconciliations.masterId, auth.masterId)
          )
        )
        .returning();
      if (!updated) return reply.code(404).send({ error: 'RECONCILIATION_NOT_FOUND' });

      return reply.send({ reconciliation: updated });
    }
  );

  // Variance Cases, Explanations (append-only), Decisions (WRITE_OFF), and Liability Entries
  app.get('/variance-cases', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db
      .select()
      .from(varianceCases)
      .where(eq(varianceCases.masterId, auth.masterId))
      .orderBy(desc(varianceCases.createdAt));
    return reply.send({ varianceCases: rows });
  });

  app.post('/variance-cases/:id/explanations', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        reasonCode: z.string().min(2),
        explanationText: z.string().min(3),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const [vc] = await db
      .select()
      .from(varianceCases)
      .where(and(eq(varianceCases.id, id), eq(varianceCases.masterId, auth.masterId)))
      .limit(1);
    if (!vc) return reply.code(404).send({ error: 'VARIANCE_CASE_NOT_FOUND' });

    const verRes = await db.execute(sql`
      SELECT COALESCE(MAX(version), 0)::int AS max_ver
      FROM variance_explanations
      WHERE variance_case_id = ${id}
    `);
    const nextVersion = Number((verRes.rows[0] as { max_ver: number })?.max_ver ?? 0) + 1;

    const [exp] = await db
      .insert(varianceExplanations)
      .values({
        masterId: auth.masterId,
        varianceCaseId: id,
        version: nextVersion,
        reasonCode: parsed.data.reasonCode,
        explanationText: parsed.data.explanationText,
        submittedByType: auth.actorType,
        submittedById: auth.userId,
      })
      .returning();

    await db
      .update(varianceCases)
      .set({ status: 'EXPLAINED' })
      .where(eq(varianceCases.id, id));

    return reply.code(201).send({ explanation: exp });
  });

  app.post(
    '/variance-cases/:id/decide',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          decision: z.enum(['ACCEPT', 'PARTIAL', 'CHARGE']),
          chargeAmountCents: z.number().int().min(0).default(0),
          notes: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const out = await db.transaction(async (tx) => {
        const [vc] = await tx
          .select()
          .from(varianceCases)
          .where(and(eq(varianceCases.id, id), eq(varianceCases.masterId, auth.masterId)))
          .limit(1);
        if (!vc) {
          throw Object.assign(new Error('Variance case not found'), { statusCode: 404 });
        }

        const [decisionRow] = await tx
          .insert(varianceDecisions)
          .values({
            masterId: auth.masterId,
            varianceCaseId: id,
            decision: parsed.data.decision,
            chargeAmountCents: parsed.data.chargeAmountCents,
            decidedBy: auth.userId,
            notes: parsed.data.notes ?? null,
          })
          .returning();

        await tx
          .update(varianceCases)
          .set({ status: 'DECIDED' })
          .where(eq(varianceCases.id, id));

        // Write WRITE_OFF stock movement for confirmed nominal shortfall
        if (vc.shortfallNominalGrams > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: vc.batchId,
            assignmentId: vc.assignmentId,
            grade: 'GRADE_1',
            movementType: 'WRITE_OFF',
            deltaNominalGrams: -vc.shortfallNominalGrams,
            referenceId: vc.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }

        let liability = null;
        if (
          (parsed.data.decision === 'PARTIAL' || parsed.data.decision === 'CHARGE') &&
          parsed.data.chargeAmountCents > 0 &&
          vc.responsibleType === 'SELLER'
        ) {
          const [liab] = await tx
            .insert(liabilityEntries)
            .values({
              masterId: auth.masterId,
              salespersonId: vc.responsibleId,
              varianceCaseId: vc.id,
              entryType: 'CHARGE',
              amountCents: parsed.data.chargeAmountCents,
            })
            .returning();
          liability = liab;
        }

        await writeAuditEvent(tx, {
          masterId: auth.masterId,
          actorType: 'MASTER',
          actorId: auth.userId,
          actorRole: 'MERCHANT',
          entityType: 'variance_case',
          entityId: vc.id,
          action: 'VARIANCE_DECIDED',
          outcome: 'SUCCESS',
          afterState: {
            decision: parsed.data.decision,
            chargeAmountCents: parsed.data.chargeAmountCents,
          },
        });

        return { decision: decisionRow, liability };
      });

      return reply.send(out);
    }
  );

  app.post('/liability-entries/:id/dispute', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z.object({ disputeNote: z.string().min(3) }).safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const [updated] = await db
      .update(liabilityEntries)
      .set({ isDisputed: true, disputeNote: parsed.data.disputeNote })
      .where(
        and(
          eq(liabilityEntries.id, id),
          eq(liabilityEntries.masterId, auth.masterId),
          auth.role === 'SELLER' ? eq(liabilityEntries.salespersonId, auth.userId) : sql`true`
        )
      )
      .returning();
    if (!updated) return reply.code(404).send({ error: 'LIABILITY_ENTRY_NOT_FOUND' });

    return reply.send({ liabilityEntry: updated });
  });

  // SSE live updates
  app.get('/events', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const clientId = `${auth.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    sseHub.addClient({
      id: clientId,
      masterId: auth.masterId,
      userType: auth.actorType,
      userId: auth.userId,
      reply,
    });
    request.raw.on('close', () => {
      sseHub.removeClient(clientId);
    });
    return reply;
  });

  // Audit Events (Master only)
  app.get('/audit-events', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const events = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.masterId, request.auth!.masterId))
      .orderBy(desc(auditEvents.serverTime))
      .limit(200);
    return reply.send({ auditEvents: events });
  });
}
