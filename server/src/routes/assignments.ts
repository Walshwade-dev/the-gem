import { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  assignmentDailyAcknowledgments,
  salespeople,
  sessions,
  stockAssignments,
  truckBatches,
  varianceCases,
} from '../db/schema.js';
import { createAuthMiddleware, requireMaster } from '../auth/middleware.js';
import { normalizeKenyaPhoneToE164 } from '../utils/phone.js';
import { getNairobiBusinessDate } from '../utils/time.js';
import { writeAuditEvent } from '../services/audit.js';
import { withIdempotency } from '../services/idempotency.js';
import { createOrSubmitReconciliation } from '../services/reconciliation.js';
import { appendStockMovement, getAssignmentAvailableNominalGrams, getBatchPoolNominalGrams } from '../services/stockLedger.js';
import { AppRouteDeps, sendValidationError } from './types.js';

export async function registerAssignmentRoutes(app: FastifyInstance, deps: AppRouteDeps) {
  const { db, config, clerkVerifier, notifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // GET /assignments
  app.get('/assignments', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db
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
      .orderBy(desc(stockAssignments.openedAt));

    const enriched = await Promise.all(
      rows.map(async (a) => {
        const g1 = await getAssignmentAvailableNominalGrams(db, a.id, 'GRADE_1');
        const g2 = await getAssignmentAvailableNominalGrams(db, a.id, 'GRADE_2');
        return {
          ...a,
          availableGrade1NominalGrams: g1,
          availableGrade2NominalGrams: g2,
        };
      })
    );

    return reply.send({ assignments: enriched });
  });

  // POST /assignments (Master only, idempotent)
  app.post('/assignments', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const parsed = z
      .object({
        phoneE164: z.string().min(9),
        fullName: z.string().min(1),
        nationalId: z.string().optional(),
        batchId: z.string().uuid(),
        grade1NominalGrams: z.number().int().min(0),
        grade2NominalGrams: z.number().int().min(0),
        expectedPriceG1Cents: z.number().int().positive().optional(),
        expectedPriceG2Cents: z.number().int().positive().optional(),
        creditCapNominalGrams: z.number().int().min(0).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const data = parsed.data;
    if (data.grade1NominalGrams + data.grade2NominalGrams <= 0) {
      return reply.code(400).send({ error: 'ZERO_ALLOCATION_NOT_ALLOWED' });
    }

    let phoneE164: string;
    try {
      phoneE164 = normalizeKenyaPhoneToE164(data.phoneE164);
    } catch {
      return reply.code(400).send({ error: 'INVALID_KENYA_PHONE' });
    }

    const idemKey = request.headers['idempotency-key'] as string | undefined;
    const result = await withIdempotency({
      db,
      key: idemKey,
      masterId: auth.masterId,
      actorId: auth.userId,
      route: 'POST /assignments',
      requestBody: data,
      handler: async () => {
        const created = await db.transaction(async (tx) => {
          // Lock batch row
          const batchRes = await tx.execute(
            sql`SELECT * FROM truck_batches WHERE id = ${data.batchId} AND master_id = ${auth.masterId} FOR UPDATE`
          );
          const batchRow = batchRes.rows[0] as
            | {
                id: string;
                status: string;
                price_g1_cents: number | null;
                price_g2_cents: number | null;
              }
            | undefined;
          if (!batchRow || batchRow.status !== 'ACTIVE') {
            throw Object.assign(new Error('Active batch not found'), {
              statusCode: 404,
              code: 'BATCH_NOT_FOUND',
            });
          }

          let [seller] = await tx
            .select()
            .from(salespeople)
            .where(
              and(eq(salespeople.masterId, auth.masterId), eq(salespeople.phoneE164, phoneE164))
            )
            .limit(1);

          if (!seller) {
            [seller] = await tx
              .insert(salespeople)
              .values({
                masterId: auth.masterId,
                phoneE164,
                fullName: data.fullName,
                nationalId: data.nationalId ?? null,
                status: 'INVITED',
                creditCapNominalGrams: data.creditCapNominalGrams ?? 200000,
              })
              .returning();
          } else if (data.creditCapNominalGrams !== undefined) {
            [seller] = await tx
              .update(salespeople)
              .set({
                creditCapNominalGrams: data.creditCapNominalGrams,
                status: seller.status === 'REVOKED' ? 'ACTIVE' : seller.status,
              })
              .where(eq(salespeople.id, seller.id))
              .returning();
          }

          const existingActive = await tx
            .select({ id: stockAssignments.id })
            .from(stockAssignments)
            .where(
              and(
                eq(stockAssignments.salespersonId, seller.id),
                eq(stockAssignments.batchId, data.batchId),
                eq(stockAssignments.status, 'ACTIVE')
              )
            )
            .limit(1);
          if (existingActive.length > 0) {
            throw Object.assign(new Error('Seller already has an active assignment on this batch'), {
              statusCode: 409,
              code: 'ACTIVE_ASSIGNMENT_EXISTS',
            });
          }

          const poolG1 = await getBatchPoolNominalGrams(tx, data.batchId, 'GRADE_1');
          const poolG2 = await getBatchPoolNominalGrams(tx, data.batchId, 'GRADE_2');
          if (poolG1 < data.grade1NominalGrams || poolG2 < data.grade2NominalGrams) {
            throw Object.assign(new Error('Insufficient stock in batch pool'), {
              statusCode: 409,
              code: 'INSUFFICIENT_BATCH_POOL',
            });
          }

          const [assignment] = await tx
            .insert(stockAssignments)
            .values({
              masterId: auth.masterId,
              batchId: data.batchId,
              salespersonId: seller.id,
              expectedPriceG1Cents: data.expectedPriceG1Cents ?? batchRow.price_g1_cents ?? 0,
              expectedPriceG2Cents: data.expectedPriceG2Cents ?? batchRow.price_g2_cents ?? 0,
              status: 'ACTIVE',
            })
            .returning();

          if (data.grade1NominalGrams > 0) {
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: null,
              grade: 'GRADE_1',
              movementType: 'ALLOCATE',
              deltaNominalGrams: -data.grade1NominalGrams,
              referenceId: assignment.id,
              actorType: 'MASTER',
              actorId: auth.userId,
            });
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: assignment.id,
              grade: 'GRADE_1',
              movementType: 'ALLOCATE',
              deltaNominalGrams: data.grade1NominalGrams,
              referenceId: assignment.id,
              actorType: 'MASTER',
              actorId: auth.userId,
            });
          }
          if (data.grade2NominalGrams > 0) {
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: null,
              grade: 'GRADE_2',
              movementType: 'ALLOCATE',
              deltaNominalGrams: -data.grade2NominalGrams,
              referenceId: assignment.id,
              actorType: 'MASTER',
              actorId: auth.userId,
            });
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: assignment.id,
              grade: 'GRADE_2',
              movementType: 'ALLOCATE',
              deltaNominalGrams: data.grade2NominalGrams,
              referenceId: assignment.id,
              actorType: 'MASTER',
              actorId: auth.userId,
            });
          }

          await tx.insert(assignmentDailyAcknowledgments).values({
            masterId: auth.masterId,
            assignmentId: assignment.id,
            businessDate: getNairobiBusinessDate(),
            eventType: 'DAILY_OPEN',
            expectedG1NominalGrams: data.grade1NominalGrams,
            expectedG2NominalGrams: data.grade2NominalGrams,
            status: 'PENDING',
          });

          await writeAuditEvent(tx, {
            masterId: auth.masterId,
            actorType: 'MASTER',
            actorId: auth.userId,
            actorRole: 'MERCHANT',
            entityType: 'stock_assignment',
            entityId: assignment.id,
            action: 'ASSIGNMENT_CREATED',
            outcome: 'SUCCESS',
            afterState: {
              salespersonId: seller.id,
              grade1NominalGrams: data.grade1NominalGrams,
              grade2NominalGrams: data.grade2NominalGrams,
            },
          });

          return { assignment, seller };
        });

        await notifier.notify({
          type: 'ASSIGNMENT_CREATED',
          masterId: auth.masterId,
          targetUserType: 'SELLER',
          targetUserId: created.seller.id,
          title: 'New Stock Assigned',
          body: 'You have been assigned stock. Please acknowledge receipt.',
          data: { type: 'ASSIGNMENT_CREATED', assignmentId: created.assignment.id },
        });

        return { status: 201, body: created };
      },
    });

    return reply.code(result.status).send(result.body);
  });

  // POST /assignments/:id/topup (Master only)
  app.post(
    '/assignments/:id/topup',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          grade1NominalGrams: z.number().int().min(0).default(0),
          grade2NominalGrams: z.number().int().min(0).default(0),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const { grade1NominalGrams, grade2NominalGrams } = parsed.data;
      if (grade1NominalGrams + grade2NominalGrams <= 0) {
        return reply.code(400).send({ error: 'ZERO_TOPUP_NOT_ALLOWED' });
      }

      const updated = await db.transaction(async (tx) => {
        const [assignment] = await tx
          .select()
          .from(stockAssignments)
          .where(and(eq(stockAssignments.id, id), eq(stockAssignments.masterId, auth.masterId)))
          .limit(1);
        if (!assignment || assignment.status !== 'ACTIVE') {
          throw Object.assign(new Error('Active assignment not found'), {
            statusCode: 404,
            code: 'ASSIGNMENT_NOT_FOUND',
          });
        }

        const poolG1 = await getBatchPoolNominalGrams(tx, assignment.batchId, 'GRADE_1');
        const poolG2 = await getBatchPoolNominalGrams(tx, assignment.batchId, 'GRADE_2');
        if (poolG1 < grade1NominalGrams || poolG2 < grade2NominalGrams) {
          throw Object.assign(new Error('Insufficient stock in batch pool'), {
            statusCode: 409,
            code: 'INSUFFICIENT_BATCH_POOL',
          });
        }

        if (grade1NominalGrams > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: null,
            grade: 'GRADE_1',
            movementType: 'TOPUP',
            deltaNominalGrams: -grade1NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: assignment.id,
            grade: 'GRADE_1',
            movementType: 'TOPUP',
            deltaNominalGrams: grade1NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }

        if (grade2NominalGrams > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: null,
            grade: 'GRADE_2',
            movementType: 'TOPUP',
            deltaNominalGrams: -grade2NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: assignment.id,
            grade: 'GRADE_2',
            movementType: 'TOPUP',
            deltaNominalGrams: grade2NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }

        await tx.insert(assignmentDailyAcknowledgments).values({
          masterId: auth.masterId,
          assignmentId: assignment.id,
          businessDate: getNairobiBusinessDate(),
          eventType: 'TOPUP',
          expectedG1NominalGrams: grade1NominalGrams,
          expectedG2NominalGrams: grade2NominalGrams,
          status: 'PENDING',
        });

        return assignment;
      });

      return reply.send({ assignment: updated });
    }
  );

  // POST /assignments/:id/close (Master only) - requires final physical count; blocks if open variance case exists unless forced? Wait: opens variance case if shortfall and blocks close if unresolved shortfall!
  app.post(
    '/assignments/:id/close',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          physicalG1NominalGrams: z.number().int().min(0),
          physicalG2NominalGrams: z.number().int().min(0),
          actualCashCents: z.number().int().min(0).optional(),
          notes: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const [assignment] = await db
        .select()
        .from(stockAssignments)
        .where(and(eq(stockAssignments.id, id), eq(stockAssignments.masterId, auth.masterId)))
        .limit(1);
      if (!assignment || assignment.status !== 'ACTIVE') {
        return reply.code(404).send({ error: 'ASSIGNMENT_NOT_FOUND' });
      }

      const businessDate = getNairobiBusinessDate();
      const recResult = await createOrSubmitReconciliation(db, {
        masterId: auth.masterId,
        batchId: assignment.batchId,
        assignmentId: assignment.id,
        businessDate,
        physicalG1NominalGrams: parsed.data.physicalG1NominalGrams,
        physicalG2NominalGrams: parsed.data.physicalG2NominalGrams,
        actualCashCents: parsed.data.actualCashCents,
        notes: parsed.data.notes,
        status: 'SUBMITTED',
      });

      if (recResult.varianceCase) {
        return reply.code(409).send({
          error: 'UNEXPLAINED_SHORTFALL_BLOCKS_CLOSE',
          message: 'Final physical count has a shortfall; variance case opened and must be decided before closing assignment.',
          varianceCase: recResult.varianceCase,
          reconciliation: recResult.reconciliation,
        });
      }

      // Check if any OPEN variance case still exists on this assignment
      const openCases = await db
        .select({ id: varianceCases.id })
        .from(varianceCases)
        .where(and(eq(varianceCases.assignmentId, id), eq(varianceCases.status, 'OPEN')))
        .limit(1);
      if (openCases.length > 0) {
        return reply.code(409).send({
          error: 'OPEN_VARIANCE_CASE_EXISTS',
          message: 'Resolve open variance cases before closing assignment.',
        });
      }

      const closed = await db.transaction(async (tx) => {
        // Return unsold physical stock to batch pool
        if (parsed.data.physicalG1NominalGrams > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: assignment.id,
            grade: 'GRADE_1',
            movementType: 'RETURN',
            deltaNominalGrams: -parsed.data.physicalG1NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: null,
            grade: 'GRADE_1',
            movementType: 'RETURN',
            deltaNominalGrams: parsed.data.physicalG1NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }
        if (parsed.data.physicalG2NominalGrams > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: assignment.id,
            grade: 'GRADE_2',
            movementType: 'RETURN',
            deltaNominalGrams: -parsed.data.physicalG2NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: null,
            grade: 'GRADE_2',
            movementType: 'RETURN',
            deltaNominalGrams: parsed.data.physicalG2NominalGrams,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }

        const [updated] = await tx
          .update(stockAssignments)
          .set({ status: 'CLOSED', closedAt: new Date(), closedBy: auth.userId })
          .where(eq(stockAssignments.id, assignment.id))
          .returning();

        // If seller has no remaining active assignments, revoke active sessions immediately
        const remaining = await tx
          .select({ id: stockAssignments.id })
          .from(stockAssignments)
          .where(
            and(
              eq(stockAssignments.salespersonId, assignment.salespersonId),
              eq(stockAssignments.status, 'ACTIVE')
            )
          )
          .limit(1);
        if (remaining.length === 0) {
          await tx
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(sessions.salespersonId, assignment.salespersonId),
                isNull(sessions.revokedAt)
              )
            );
        }

        return updated;
      });

      return reply.send({ assignment: closed, reconciliation: recResult.reconciliation });
    }
  );

  // POST /assignments/:id/revoke (Master only)
  app.post(
    '/assignments/:id/revoke',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;

      const revoked = await db.transaction(async (tx) => {
        const [assignment] = await tx
          .select()
          .from(stockAssignments)
          .where(and(eq(stockAssignments.id, id), eq(stockAssignments.masterId, auth.masterId)))
          .limit(1);
        if (!assignment || assignment.status !== 'ACTIVE') {
          throw Object.assign(new Error('Active assignment not found'), {
            statusCode: 404,
            code: 'ASSIGNMENT_NOT_FOUND',
          });
        }

        const g1 = await getAssignmentAvailableNominalGrams(tx, assignment.id, 'GRADE_1');
        const g2 = await getAssignmentAvailableNominalGrams(tx, assignment.id, 'GRADE_2');

        if (g1 > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: assignment.id,
            grade: 'GRADE_1',
            movementType: 'RETURN',
            deltaNominalGrams: -g1,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: null,
            grade: 'GRADE_1',
            movementType: 'RETURN',
            deltaNominalGrams: g1,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }
        if (g2 > 0) {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: assignment.id,
            grade: 'GRADE_2',
            movementType: 'RETURN',
            deltaNominalGrams: -g2,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: assignment.batchId,
            assignmentId: null,
            grade: 'GRADE_2',
            movementType: 'RETURN',
            deltaNominalGrams: g2,
            referenceId: assignment.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
        }

        const [updated] = await tx
          .update(stockAssignments)
          .set({ status: 'REVOKED', closedAt: new Date(), closedBy: auth.userId })
          .where(eq(stockAssignments.id, assignment.id))
          .returning();

        const remaining = await tx
          .select({ id: stockAssignments.id })
          .from(stockAssignments)
          .where(
            and(
              eq(stockAssignments.salespersonId, assignment.salespersonId),
              eq(stockAssignments.status, 'ACTIVE')
            )
          )
          .limit(1);
        if (remaining.length === 0) {
          await tx
            .update(sessions)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(sessions.salespersonId, assignment.salespersonId),
                isNull(sessions.revokedAt)
              )
            );
        }

        return updated;
      });

      return reply.send({ assignment: revoked });
    }
  );

  // POST /assignments/:id/acknowledge (Seller confirms opening/topup stock)
  app.post('/assignments/:id/acknowledge', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const auth = request.auth!;

    const [ack] = await db
      .select()
      .from(assignmentDailyAcknowledgments)
      .where(
        and(
          eq(assignmentDailyAcknowledgments.assignmentId, id),
          eq(assignmentDailyAcknowledgments.masterId, auth.masterId),
          eq(assignmentDailyAcknowledgments.status, 'PENDING')
        )
      )
      .limit(1);
    if (!ack) return reply.code(404).send({ error: 'NO_PENDING_ACKNOWLEDGMENT' });

    const [updated] = await db
      .update(assignmentDailyAcknowledgments)
      .set({
        status: 'ACKNOWLEDGED',
        physicalG1NominalGrams: ack.expectedG1NominalGrams,
        physicalG2NominalGrams: ack.expectedG2NominalGrams,
        acknowledgedAt: new Date(),
      })
      .where(eq(assignmentDailyAcknowledgments.id, ack.id))
      .returning();

    return reply.send({ acknowledgment: updated });
  });

  // POST /assignments/:id/discrepancy (Seller flags physical count discrepancy)
  app.post('/assignments/:id/discrepancy', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        physicalG1NominalGrams: z.number().int().min(0),
        physicalG2NominalGrams: z.number().int().min(0),
        note: z.string().min(1),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const [ack] = await db
      .select()
      .from(assignmentDailyAcknowledgments)
      .where(
        and(
          eq(assignmentDailyAcknowledgments.assignmentId, id),
          eq(assignmentDailyAcknowledgments.masterId, auth.masterId),
          eq(assignmentDailyAcknowledgments.status, 'PENDING')
        )
      )
      .limit(1);
    if (!ack) return reply.code(404).send({ error: 'NO_PENDING_ACKNOWLEDGMENT' });

    const [updated] = await db
      .update(assignmentDailyAcknowledgments)
      .set({
        status: 'DISCREPANCY',
        physicalG1NominalGrams: parsed.data.physicalG1NominalGrams,
        physicalG2NominalGrams: parsed.data.physicalG2NominalGrams,
        note: parsed.data.note,
        acknowledgedAt: new Date(),
      })
      .where(eq(assignmentDailyAcknowledgments.id, ack.id))
      .returning();

    await notifier.notify({
      type: 'DISCREPANCY_FLAGGED',
      masterId: auth.masterId,
      targetUserType: 'MASTER',
      title: 'Stock Discrepancy Flagged',
      body: parsed.data.note,
      data: { type: 'DISCREPANCY_FLAGGED', acknowledgmentId: updated.id },
    });

    return reply.send({ acknowledgment: updated });
  });

  // POST /discrepancy-alerts/:id/resolve (Master only)
  app.post(
    '/discrepancy-alerts/:id/resolve',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z.object({ note: z.string().optional() }).safeParse(request.body ?? {});
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const [updated] = await db
        .update(assignmentDailyAcknowledgments)
        .set({
          status: 'RESOLVED',
          note: parsed.data.note ?? undefined,
          resolvedBy: auth.userId,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(assignmentDailyAcknowledgments.id, id),
            eq(assignmentDailyAcknowledgments.masterId, auth.masterId)
          )
        )
        .returning();
      if (!updated) return reply.code(404).send({ error: 'DISCREPANCY_NOT_FOUND' });

      return reply.send({ acknowledgment: updated });
    }
  );

  // PATCH /salespeople/:id (Master only)
  app.patch(
    '/salespeople/:id',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          nationalId: z.string().optional(),
          creditCapNominalGrams: z.number().int().min(0).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const [updated] = await db
        .update(salespeople)
        .set(parsed.data)
        .where(and(eq(salespeople.id, id), eq(salespeople.masterId, request.auth!.masterId)))
        .returning();
      if (!updated) return reply.code(404).send({ error: 'SALESPERSON_NOT_FOUND' });
      return reply.send({ seller: updated });
    }
  );
}
