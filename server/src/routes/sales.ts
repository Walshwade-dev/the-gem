import { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  buyers,
  creditEntries,
  marketSessions,
  masters,
  payments,
  priceApprovals,
  sales,
  salespeople,
  smsOutbox,
  stockAssignments,
  truckBatches,
} from '../db/schema.js';
import { createAuthMiddleware, requireMaster } from '../auth/middleware.js';
import { calculateBilledAmountCents } from '../utils/money.js';
import { normalizeKenyaPhoneToE164 } from '../utils/phone.js';
import { addDaysToDateStr, getNairobiBusinessDate } from '../utils/time.js';
import { writeAuditEvent } from '../services/audit.js';
import { withIdempotency } from '../services/idempotency.js';
import { appendStockMovement, getAssignmentAvailableNominalGrams, getBatchPoolNominalGrams } from '../services/stockLedger.js';
import { AppRouteDeps, sendValidationError } from './types.js';

export async function registerSalesRoutes(app: FastifyInstance, deps: AppRouteDeps) {
  const { db, config, clerkVerifier, notifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // GET /sales
  app.get('/sales', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db
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
      .limit(200);
    return reply.send({ sales: rows });
  });

  // POST /sales (idempotent)
  app.post('/sales', { preHandler: authenticate }, async (request, reply) => {
    const parsed = z
      .object({
        batchId: z.string().uuid(),
        assignmentId: z.string().uuid().optional(),
        grade: z.enum(['GRADE_1', 'GRADE_2']),
        pricingMode: z.enum(['PER_NET', 'BY_WEIGHT']),
        quantityNominalGrams: z.number().int().positive(),
        weighedGrams: z.number().int().positive(),
        unitPricePerNetCents: z.number().int().positive(),
        paymentMode: z.enum(['CASH', 'MPESA', 'CREDIT']),
        mpesaReceipt: z.string().min(4).optional(),
        payerPhoneE164: z.string().optional(),
        buyerName: z.string().optional(),
        buyer: z
          .object({
            fullName: z.string().min(1),
            phoneE164: z.string().min(9),
            nationalId: z.string().min(4),
            marketingConsent: z.boolean().default(false),
          })
          .optional(),
        guarantorAccepted: z.boolean().default(false),
        guarantorTermsVersion: z.string().optional(),
        isOfflineSynced: z.boolean().default(false),
        clientTime: z.string().datetime().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const data = parsed.data;

    if (auth.role === 'SELLER' && !data.assignmentId) {
      return reply.code(400).send({ error: 'ASSIGNMENT_ID_REQUIRED_FOR_SELLER' });
    }
    if (data.paymentMode === 'CREDIT' && !data.buyer) {
      return reply.code(400).send({
        error: 'BUYER_DETAILS_REQUIRED_FOR_CREDIT',
        message: 'Credit sales require buyer fullName, phoneE164, and nationalId',
      });
    }
    if (data.paymentMode === 'MPESA') {
      if (!data.mpesaReceipt || !/^[A-Z0-9]{10}$/.test(data.mpesaReceipt)) {
        return reply.code(400).send({
          error: 'INVALID_MPESA_DETAILS',
          message: 'M-Pesa payment requires a valid 10-character uppercase alphanumeric M-Pesa confirmation code',
        });
      }
    }

    let normalizedBuyerPhone: string | null = null;
    if (data.buyer) {
      try {
        normalizedBuyerPhone = normalizeKenyaPhoneToE164(data.buyer.phoneE164);
      } catch {
        return reply.code(400).send({ error: 'INVALID_BUYER_PHONE' });
      }
    }

    const idemKey = request.headers['idempotency-key'] as string | undefined;
    const result = await withIdempotency({
      db,
      key: idemKey,
      masterId: auth.masterId,
      actorId: auth.userId,
      route: 'POST /sales',
      requestBody: data,
      handler: async () => {
        const businessDate = getNairobiBusinessDate();

        const created = await db.transaction(async (tx) => {
          const [master] = await tx
            .select()
            .from(masters)
            .where(eq(masters.id, auth.masterId))
            .limit(1);
          if (!master) {
            throw Object.assign(new Error('Master not found'), { statusCode: 404 });
          }

          if (auth.role === 'SELLER' && data.pricingMode === 'BY_WEIGHT' && !master.allowByWeightSellers) {
            throw Object.assign(new Error('By-weight pricing is disabled for sellers by Master'), {
              statusCode: 403,
              code: 'BY_WEIGHT_DISABLED_FOR_SELLERS',
            });
          }

          // Market session check (14:00 EAT cutoff)
          const [mkt] = await tx
            .select()
            .from(marketSessions)
            .where(
              and(
                eq(marketSessions.masterId, auth.masterId),
                eq(marketSessions.businessDate, businessDate)
              )
            )
            .limit(1);

          let isLateSale = false;
          let pendingReview = false;
          if (mkt?.closedAt && !mkt.lateSessionOpen) {
            if (data.isOfflineSynced) {
              isLateSale = true;
              pendingReview = true;
            } else {
              throw Object.assign(new Error('Market is closed for today (14:00 EAT cutoff)'), {
                statusCode: 403,
                code: 'MARKET_CLOSED',
              });
            }
          } else if (mkt?.lateSessionOpen) {
            if (mkt.lateEndsAt && mkt.lateEndsAt < new Date() && !data.isOfflineSynced) {
              throw Object.assign(new Error('Late session has expired'), {
                statusCode: 403,
                code: 'LATE_SESSION_EXPIRED',
              });
            }
            isLateSale = true;
          }

          // Lock batch (and assignment if seller)
          const batchRes = await tx.execute(
            sql`SELECT * FROM truck_batches WHERE id = ${data.batchId} AND master_id = ${auth.masterId} FOR UPDATE`
          );
          const batchRow = batchRes.rows[0] as
            | {
                id: string;
                status: string;
                packaging_grams: number;
                price_g1_cents: number | null;
                min_price_g1_cents: number | null;
                price_g2_cents: number | null;
                min_price_g2_cents: number | null;
              }
            | undefined;
          if (!batchRow || batchRow.status !== 'ACTIVE') {
            throw Object.assign(new Error('Active batch not found'), {
              statusCode: 404,
              code: 'BATCH_NOT_FOUND',
            });
          }

          let availableGrams = 0;
          if (data.assignmentId) {
            const assignRes = await tx.execute(
              sql`SELECT * FROM stock_assignments WHERE id = ${data.assignmentId} AND master_id = ${auth.masterId} FOR UPDATE`
            );
            const assignRow = assignRes.rows[0] as
              | { id: string; batch_id: string; salesperson_id: string; status: string }
              | undefined;
            if (
              !assignRow ||
              assignRow.status !== 'ACTIVE' ||
              assignRow.batch_id !== data.batchId ||
              (auth.role === 'SELLER' && assignRow.salesperson_id !== auth.userId)
            ) {
              throw Object.assign(new Error('Active assignment not found'), {
                statusCode: 403,
                code: 'ASSIGNMENT_INVALID',
              });
            }
            availableGrams = await getAssignmentAvailableNominalGrams(
              tx,
              data.assignmentId,
              data.grade
            );
          } else {
            availableGrams = await getBatchPoolNominalGrams(tx, data.batchId, data.grade);
          }

          if (availableGrams < data.quantityNominalGrams) {
            throw Object.assign(new Error('Insufficient stock'), {
              statusCode: 409,
              code: 'INSUFFICIENT_STOCK',
            });
          }

          const billedGrams =
            data.pricingMode === 'PER_NET' ? data.quantityNominalGrams : data.weighedGrams;
          const totalAmountCents = calculateBilledAmountCents(
            data.unitPricePerNetCents,
            billedGrams,
            batchRow.packaging_grams,
            master.roundingRule
          );

          const listPriceCents =
            data.grade === 'GRADE_1'
              ? batchRow.price_g1_cents ?? data.unitPricePerNetCents
              : batchRow.price_g2_cents ?? data.unitPricePerNetCents;
          const floorPriceCents =
            data.grade === 'GRADE_1'
              ? batchRow.min_price_g1_cents ?? listPriceCents
              : batchRow.min_price_g2_cents ?? listPriceCents;

          const needsPriceApproval =
            auth.role === 'SELLER' && data.unitPricePerNetCents < floorPriceCents;

          // Upsert buyer if present
          let buyerId: string | null = null;
          if (data.buyer && normalizedBuyerPhone) {
            const [b] = await tx
              .insert(buyers)
              .values({
                masterId: auth.masterId,
                fullName: data.buyer.fullName,
                phoneE164: normalizedBuyerPhone,
                nationalId: data.buyer.nationalId,
                marketingConsent: data.buyer.marketingConsent,
              })
              .onConflictDoUpdate({
                target: [buyers.masterId, buyers.phoneE164],
                set: {
                  fullName: data.buyer.fullName,
                  nationalId: data.buyer.nationalId,
                },
              })
              .returning();
            buyerId = b.id;
          }

          // Credit anti-double-entry & existing unpaid credit gate
          if (data.paymentMode === 'CREDIT') {
            const candidateBuyerIds = new Set<string>();
            if (buyerId) candidateBuyerIds.add(buyerId);
            if (data.buyer?.nationalId) {
              const matchingBuyers = await tx
                .select({ id: buyers.id })
                .from(buyers)
                .where(
                  and(
                    eq(buyers.masterId, auth.masterId),
                    eq(buyers.nationalId, data.buyer.nationalId)
                  )
                );
              for (const mb of matchingBuyers) candidateBuyerIds.add(mb.id);
            }

            if (candidateBuyerIds.size > 0) {
              const buyerIdList = Array.from(candidateBuyerIds);
              const existingCredits = await tx
                .select({
                  id: creditEntries.id,
                  batchId: creditEntries.batchId,
                  totalOwedCents: creditEntries.totalOwedCents,
                  approvalStatus: creditEntries.approvalStatus,
                  createdAt: creditEntries.createdAt,
                })
                .from(creditEntries)
                .where(
                  and(
                    eq(creditEntries.masterId, auth.masterId),
                    inArray(creditEntries.buyerId, buyerIdList)
                  )
                );

              const tenSecAgo = Date.now() - 15_000;
              const duplicateEntry = existingCredits.find(
                (ce) =>
                  ce.batchId === data.batchId &&
                  ce.totalOwedCents === totalAmountCents &&
                  ce.createdAt &&
                  new Date(ce.createdAt).getTime() >= tenSecAgo
              );
              if (duplicateEntry) {
                throw Object.assign(
                  new Error('Duplicate credit entry detected. This credit has already been recorded.'),
                  { statusCode: 409, code: 'DUPLICATE_CREDIT_ENTRY' }
                );
              }

              if (existingCredits.length > 0) {
                const creditIds = existingCredits.map((ce) => ce.id);
                const paymentRows = await tx
                  .select({
                    creditEntryId: payments.creditEntryId,
                    amountCents: payments.amountCents,
                  })
                  .from(payments)
                  .where(inArray(payments.creditEntryId, creditIds));

                const paidByCreditId = new Map<string, number>();
                for (const p of paymentRows) {
                  if (!p.creditEntryId) continue;
                  paidByCreditId.set(
                    p.creditEntryId,
                    (paidByCreditId.get(p.creditEntryId) ?? 0) + p.amountCents
                  );
                }

                for (const ce of existingCredits) {
                  if (ce.approvalStatus === 'REJECTED') continue;
                  const paidCents = paidByCreditId.get(ce.id) ?? 0;
                  const balanceCents = ce.totalOwedCents - paidCents;
                  if (balanceCents > 0) {
                    const unpaidKsh = Math.round(balanceCents / 100);
                    throw Object.assign(
                      new Error(
                        `Customer has an existing unpaid credit of Ksh ${unpaidKsh.toLocaleString()}. They must pay first before being allowed another credit.`
                      ),
                      { statusCode: 409, code: 'EXISTING_UNPAID_CREDIT' }
                    );
                  }
                }
              }
            }
          }

          // Credit approval evaluation
          let creditApprovalStatus: 'APPROVED' | 'PENDING' = 'APPROVED';
          let needsCreditApproval = false;
          if (data.paymentMode === 'CREDIT') {
            if (auth.role === 'MERCHANT') {
              creditApprovalStatus = 'APPROVED';
            } else {
              const [seller] = await tx
                .select()
                .from(salespeople)
                .where(eq(salespeople.id, auth.userId))
                .limit(1);
              const cap = seller?.creditCapNominalGrams ?? 200000;
              const usedRes = await tx.execute(sql`
                SELECT COALESCE(SUM(quantity_nominal_grams), 0)::int AS used
                FROM credit_entries
                WHERE seller_id = ${auth.userId}
                  AND approval_status IN ('PENDING', 'APPROVED')
              `);
              const used = Number((usedRes.rows[0] as { used: number })?.used ?? 0);
              if (data.guarantorAccepted && used + data.quantityNominalGrams <= cap) {
                creditApprovalStatus = 'APPROVED';
              } else {
                creditApprovalStatus = 'PENDING';
                needsCreditApproval = true;
              }
            }
          }

          const saleStatus =
            needsPriceApproval || needsCreditApproval ? 'PENDING_APPROVAL' : 'CONFIRMED';

          const [sale] = await tx
            .insert(sales)
            .values({
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: data.assignmentId ?? null,
              sellerType: auth.actorType,
              sellerId: auth.userId,
              buyerId,
              buyerName: data.buyerName?.trim() || data.buyer?.fullName?.trim() || null,
              grade: data.grade,
              pricingMode: data.pricingMode,
              quantityNominalGrams: data.quantityNominalGrams,
              weighedGrams: data.weighedGrams,
              billedGrams,
              listPriceCents,
              floorPriceCents,
              unitPricePerNetCents: data.unitPricePerNetCents,
              totalAmountCents,
              paymentMode: data.paymentMode,
              status: saleStatus,
              isLateSale,
              isOfflineSynced: data.isOfflineSynced,
              pendingReview,
              businessDate,
              clientTime: data.clientTime ? new Date(data.clientTime) : null,
            })
            .returning();

          if (saleStatus === 'CONFIRMED') {
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: data.assignmentId ?? null,
              grade: data.grade,
              movementType: 'SALE',
              deltaNominalGrams: -data.quantityNominalGrams,
              referenceId: sale.id,
              actorType: auth.actorType,
              actorId: auth.userId,
            });
          } else {
            await appendStockMovement(tx, {
              masterId: auth.masterId,
              batchId: data.batchId,
              assignmentId: data.assignmentId ?? null,
              grade: data.grade,
              movementType: 'RESERVE',
              deltaNominalGrams: -data.quantityNominalGrams,
              referenceId: sale.id,
              actorType: auth.actorType,
              actorId: auth.userId,
            });
          }

          let priceApproval = null;
          if (needsPriceApproval) {
            const [pa] = await tx
              .insert(priceApprovals)
              .values({
                masterId: auth.masterId,
                saleId: sale.id,
                requestedPriceCents: data.unitPricePerNetCents,
                listPriceCents,
                floorPriceCents,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
              })
              .returning();
            priceApproval = pa;
          }

          let creditEntry = null;
          if (data.paymentMode === 'CREDIT' && buyerId) {
            const dueDate = addDaysToDateStr(businessDate, master.creditTermsDays);
            const [ce] = await tx
              .insert(creditEntries)
              .values({
                masterId: auth.masterId,
                saleId: sale.id,
                buyerId,
                batchId: data.batchId,
                assignmentId: data.assignmentId ?? null,
                sellerType: auth.actorType,
                sellerId: auth.userId,
                grade: data.grade,
                quantityNominalGrams: data.quantityNominalGrams,
                totalOwedCents: totalAmountCents,
                approvalStatus: creditApprovalStatus,
                approvedBy: auth.role === 'MERCHANT' ? auth.userId : null,
                approvedAt: auth.role === 'MERCHANT' ? new Date() : null,
                dueDate,
                guarantorType: auth.actorType,
                guarantorId: auth.userId,
                guarantorAcceptedAt: data.guarantorAccepted ? new Date() : null,
                guarantorTermsVersion: data.guarantorTermsVersion ?? null,
              })
              .returning();
            creditEntry = ce;

            if (saleStatus === 'CONFIRMED' && normalizedBuyerPhone) {
              await tx.insert(smsOutbox).values({
                masterId: auth.masterId,
                toPhoneE164: normalizedBuyerPhone,
                template: 'CREDIT_CONFIRMED',
                payload: {
                  creditEntryId: ce.id,
                  totalOwedCents: totalAmountCents,
                  dueDate,
                },
                bodyText: `Credit confirmed: KSh ${(totalAmountCents / 100).toFixed(0)} due on ${dueDate}.`,
                status: 'QUEUED',
              });
            }
          } else if (saleStatus === 'CONFIRMED') {
            // CASH or MPESA payment
            await tx.insert(payments).values({
              masterId: auth.masterId,
              saleId: sale.id,
              method: data.paymentMode,
              amountCents: totalAmountCents,
              mpesaReceipt: data.mpesaReceipt ?? null,
              payerPhoneE164: data.payerPhoneE164
                ? normalizeKenyaPhoneToE164(data.payerPhoneE164)
                : null,
              source: 'MANUAL',
              recordedByType: auth.actorType,
              recordedById: auth.userId,
              businessDate,
            });
          }

          await writeAuditEvent(tx, {
            masterId: auth.masterId,
            actorType: auth.actorType,
            actorId: auth.userId,
            actorRole: auth.role,
            deviceId: auth.deviceId ?? null,
            entityType: 'sale',
            entityId: sale.id,
            action: 'SALE_RECORDED',
            outcome: 'SUCCESS',
            clientTime: data.clientTime ? new Date(data.clientTime) : null,
            afterState: {
              status: saleStatus,
              totalAmountCents,
              paymentMode: data.paymentMode,
            },
          });

          return { sale, priceApproval, creditEntry };
        });

        if (created.priceApproval || created.creditEntry?.approvalStatus === 'PENDING') {
          await notifier.notify({
            type: 'SALE_APPROVAL_REQUIRED',
            masterId: auth.masterId,
            targetUserType: 'MASTER',
            title: 'Approval Required',
            body: `Sale ${created.sale.id} requires Master approval`,
            data: { type: 'SALE_APPROVAL_REQUIRED', saleId: created.sale.id },
          });
        }

        return { status: 201, body: created };
      },
    });

    return reply.code(result.status).send(result.body);
  });

  // POST /price-approvals/:id/approve (Master only)
  app.post(
    '/price-approvals/:id/approve',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;

      const updated = await db.transaction(async (tx) => {
        const [pa] = await tx
          .select()
          .from(priceApprovals)
          .where(and(eq(priceApprovals.id, id), eq(priceApprovals.masterId, auth.masterId)))
          .limit(1);
        if (!pa || pa.status !== 'PENDING') {
          throw Object.assign(new Error('Pending price approval not found'), { statusCode: 404 });
        }

        const [updatedPa] = await tx
          .update(priceApprovals)
          .set({ status: 'APPROVED', decidedBy: auth.userId, decidedAt: new Date() })
          .where(eq(priceApprovals.id, pa.id))
          .returning();

        const [sale] = await tx
          .select()
          .from(sales)
          .where(eq(sales.id, pa.saleId))
          .limit(1);

        // Check if credit entry is still pending
        const [ce] = await tx
          .select()
          .from(creditEntries)
          .where(eq(creditEntries.saleId, sale.id))
          .limit(1);

        const nextSaleStatus =
          ce && ce.approvalStatus === 'PENDING' ? 'PENDING_APPROVAL' : 'CONFIRMED';

        const [updatedSale] = await tx
          .update(sales)
          .set({ status: nextSaleStatus })
          .where(eq(sales.id, sale.id))
          .returning();

        if (nextSaleStatus === 'CONFIRMED') {
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: sale.batchId,
            assignmentId: sale.assignmentId,
            grade: sale.grade as 'GRADE_1' | 'GRADE_2',
            movementType: 'RELEASE',
            deltaNominalGrams: sale.quantityNominalGrams,
            referenceId: sale.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: sale.batchId,
            assignmentId: sale.assignmentId,
            grade: sale.grade as 'GRADE_1' | 'GRADE_2',
            movementType: 'SALE',
            deltaNominalGrams: -sale.quantityNominalGrams,
            referenceId: sale.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          if (sale.paymentMode !== 'CREDIT') {
            await tx.insert(payments).values({
              masterId: auth.masterId,
              saleId: sale.id,
              method: sale.paymentMode,
              amountCents: sale.totalAmountCents,
              source: 'MANUAL',
              recordedByType: sale.sellerType,
              recordedById: sale.sellerId,
              businessDate: sale.businessDate,
            });
          } else if (ce && sale.buyerId) {
            const [buyer] = await tx
              .select()
              .from(buyers)
              .where(eq(buyers.id, sale.buyerId))
              .limit(1);
            if (buyer) {
              await tx.insert(smsOutbox).values({
                masterId: auth.masterId,
                toPhoneE164: buyer.phoneE164,
                template: 'CREDIT_CONFIRMED',
                payload: { creditEntryId: ce.id, totalOwedCents: ce.totalOwedCents, dueDate: ce.dueDate },
                bodyText: `Credit confirmed: KSh ${(ce.totalOwedCents / 100).toFixed(0)} due on ${ce.dueDate}.`,
                status: 'QUEUED',
              });
            }
          }
        }

        return { priceApproval: updatedPa, sale: updatedSale };
      });

      return reply.send(updated);
    }
  );

  // POST /price-approvals/:id/reject (Master only)
  app.post(
    '/price-approvals/:id/reject',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z.object({ reason: z.string().optional() }).safeParse(request.body ?? {});
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const updated = await db.transaction(async (tx) => {
        const [pa] = await tx
          .select()
          .from(priceApprovals)
          .where(and(eq(priceApprovals.id, id), eq(priceApprovals.masterId, auth.masterId)))
          .limit(1);
        if (!pa || pa.status !== 'PENDING') {
          throw Object.assign(new Error('Pending price approval not found'), { statusCode: 404 });
        }

        const [updatedPa] = await tx
          .update(priceApprovals)
          .set({
            status: 'REJECTED',
            decidedBy: auth.userId,
            decidedAt: new Date(),
            reason: parsed.data.reason ?? null,
          })
          .where(eq(priceApprovals.id, pa.id))
          .returning();

        const [sale] = await tx
          .update(sales)
          .set({ status: 'REJECTED' })
          .where(eq(sales.id, pa.saleId))
          .returning();

        await appendStockMovement(tx, {
          masterId: auth.masterId,
          batchId: sale.batchId,
          assignmentId: sale.assignmentId,
          grade: sale.grade as 'GRADE_1' | 'GRADE_2',
          movementType: 'RELEASE',
          deltaNominalGrams: sale.quantityNominalGrams,
          referenceId: sale.id,
          actorType: 'MASTER',
          actorId: auth.userId,
        });

        return { priceApproval: updatedPa, sale };
      });

      return reply.send(updated);
    }
  );

  // GET /credit-entries
  app.get('/credit-entries', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const rows = await db
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
      .orderBy(desc(creditEntries.createdAt));

    return reply.send({ creditEntries: rows });
  });

  // POST /credit-entries/:id/approve (Master only)
  app.post(
    '/credit-entries/:id/approve',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;

      const updated = await db.transaction(async (tx) => {
        const [ce] = await tx
          .select()
          .from(creditEntries)
          .where(and(eq(creditEntries.id, id), eq(creditEntries.masterId, auth.masterId)))
          .limit(1);
        if (!ce || ce.approvalStatus !== 'PENDING') {
          throw Object.assign(new Error('Pending credit entry not found'), { statusCode: 404 });
        }

        const [updatedCe] = await tx
          .update(creditEntries)
          .set({
            approvalStatus: 'APPROVED',
            approvedBy: auth.userId,
            approvedAt: new Date(),
          })
          .where(eq(creditEntries.id, ce.id))
          .returning();

        const [sale] = await tx
          .select()
          .from(sales)
          .where(eq(sales.id, ce.saleId))
          .limit(1);

        // Only confirm if price approval is not also still PENDING
        const [pa] = await tx
          .select()
          .from(priceApprovals)
          .where(eq(priceApprovals.saleId, sale.id))
          .limit(1);

        let updatedSale = sale;
        if (sale.status === 'PENDING_APPROVAL' && (!pa || pa.status === 'APPROVED')) {
          [updatedSale] = await tx
            .update(sales)
            .set({ status: 'CONFIRMED' })
            .where(eq(sales.id, sale.id))
            .returning();

          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: sale.batchId,
            assignmentId: sale.assignmentId,
            grade: sale.grade as 'GRADE_1' | 'GRADE_2',
            movementType: 'RELEASE',
            deltaNominalGrams: sale.quantityNominalGrams,
            referenceId: sale.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });
          await appendStockMovement(tx, {
            masterId: auth.masterId,
            batchId: sale.batchId,
            assignmentId: sale.assignmentId,
            grade: sale.grade as 'GRADE_1' | 'GRADE_2',
            movementType: 'SALE',
            deltaNominalGrams: -sale.quantityNominalGrams,
            referenceId: sale.id,
            actorType: 'MASTER',
            actorId: auth.userId,
          });

          const [buyer] = await tx
            .select()
            .from(buyers)
            .where(eq(buyers.id, ce.buyerId))
            .limit(1);
          if (buyer) {
            await tx.insert(smsOutbox).values({
              masterId: auth.masterId,
              toPhoneE164: buyer.phoneE164,
              template: 'CREDIT_CONFIRMED',
              payload: { creditEntryId: ce.id, totalOwedCents: ce.totalOwedCents, dueDate: ce.dueDate },
              bodyText: `Credit confirmed: KSh ${(ce.totalOwedCents / 100).toFixed(0)} due on ${ce.dueDate}.`,
              status: 'QUEUED',
            });
          }
        }

        return { creditEntry: updatedCe, sale: updatedSale };
      });

      return reply.send(updated);
    }
  );

  // POST /credit-entries/:id/reject (Master only)
  app.post(
    '/credit-entries/:id/reject',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;

      const updated = await db.transaction(async (tx) => {
        const [ce] = await tx
          .select()
          .from(creditEntries)
          .where(and(eq(creditEntries.id, id), eq(creditEntries.masterId, auth.masterId)))
          .limit(1);
        if (!ce || ce.approvalStatus !== 'PENDING') {
          throw Object.assign(new Error('Pending credit entry not found'), { statusCode: 404 });
        }

        const [updatedCe] = await tx
          .update(creditEntries)
          .set({ approvalStatus: 'REJECTED', approvedBy: auth.userId, approvedAt: new Date() })
          .where(eq(creditEntries.id, ce.id))
          .returning();

        const [sale] = await tx
          .update(sales)
          .set({ status: 'REJECTED' })
          .where(eq(sales.id, ce.saleId))
          .returning();

        await appendStockMovement(tx, {
          masterId: auth.masterId,
          batchId: sale.batchId,
          assignmentId: sale.assignmentId,
          grade: sale.grade as 'GRADE_1' | 'GRADE_2',
          movementType: 'RELEASE',
          deltaNominalGrams: sale.quantityNominalGrams,
          referenceId: sale.id,
          actorType: 'MASTER',
          actorId: auth.userId,
        });

        return { creditEntry: updatedCe, sale };
      });

      return reply.send(updated);
    }
  );

  // POST /credit-entries/:id/repayments (idempotent, allowed on CLOSED batches!)
  app.post(
    '/credit-entries/:id/repayments',
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = z
        .object({
          method: z.enum(['CASH', 'MPESA']),
          amountCents: z.number().int().positive(),
          mpesaReceipt: z.string().min(4).optional(),
          payerPhoneE164: z.string().optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      if (
        parsed.data.method === 'MPESA' &&
        (!parsed.data.mpesaReceipt ||
          !/^[A-Z0-9]{10}$/.test(parsed.data.mpesaReceipt) ||
          !parsed.data.payerPhoneE164)
      ) {
        return reply.code(400).send({ error: 'INVALID_MPESA_DETAILS' });
      }

      const auth = request.auth!;
      const idemKey = request.headers['idempotency-key'] as string | undefined;

      const result = await withIdempotency({
        db,
        key: idemKey,
        masterId: auth.masterId,
        actorId: auth.userId,
        route: `POST /credit-entries/${id}/repayments`,
        requestBody: parsed.data,
        handler: async () => {
          const out = await db.transaction(async (tx) => {
            const [ce] = await tx
              .select()
              .from(creditEntries)
              .where(and(eq(creditEntries.id, id), eq(creditEntries.masterId, auth.masterId)))
              .limit(1);
            if (!ce || ce.approvalStatus === 'REJECTED') {
              throw Object.assign(new Error('Credit entry not found'), { statusCode: 404 });
            }

            const paidRes = await tx.execute(sql`
              SELECT COALESCE(SUM(amount_cents), 0)::int AS paid
              FROM payments
              WHERE credit_entry_id = ${ce.id}
            `);
            const alreadyPaid = Number((paidRes.rows[0] as { paid: number })?.paid ?? 0);
            const remaining = Math.max(0, ce.totalOwedCents - alreadyPaid);
            if (parsed.data.amountCents > remaining) {
              throw Object.assign(new Error('Repayment exceeds remaining owed balance'), {
                statusCode: 400,
                code: 'OVERPAYMENT_NOT_ALLOWED',
              });
            }

            const [payment] = await tx
              .insert(payments)
              .values({
                masterId: auth.masterId,
                creditEntryId: ce.id,
                method: parsed.data.method,
                amountCents: parsed.data.amountCents,
                mpesaReceipt: parsed.data.mpesaReceipt ?? null,
                payerPhoneE164: parsed.data.payerPhoneE164
                  ? normalizeKenyaPhoneToE164(parsed.data.payerPhoneE164)
                  : null,
                source: 'MANUAL',
                recordedByType: auth.actorType,
                recordedById: auth.userId,
                businessDate: getNairobiBusinessDate(),
              })
              .returning();

            const newRemaining = remaining - parsed.data.amountCents;
            return { payment, remainingOwedCents: newRemaining };
          });

          return { status: 201, body: out };
        },
      });

      return reply.code(result.status).send(result.body);
    }
  );

  // GET /buyers/:id/credit-score
  app.get('/buyers/:id/credit-score', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const auth = request.auth!;

    const [buyer] = await db
      .select()
      .from(buyers)
      .where(and(eq(buyers.id, id), eq(buyers.masterId, auth.masterId)))
      .limit(1);
    if (!buyer) return reply.code(404).send({ error: 'BUYER_NOT_FOUND' });

    const entries = await db
      .select()
      .from(creditEntries)
      .where(and(eq(creditEntries.buyerId, id), eq(creditEntries.masterId, auth.masterId)));

    const paidRes = await db.execute(sql`
      SELECT COALESCE(SUM(p.amount_cents), 0)::int AS paid
      FROM payments p
      JOIN credit_entries c ON c.id = p.credit_entry_id
      WHERE c.buyer_id = ${id} AND c.master_id = ${auth.masterId}
    `);
    const totalOwedCents = entries.reduce((acc, e) => acc + e.totalOwedCents, 0);
    const totalPaidCents = Number((paidRes.rows[0] as { paid: number })?.paid ?? 0);

    return reply.send({
      buyer,
      totalCreditsCount: entries.length,
      totalOwedCents,
      totalPaidCents,
      outstandingCents: Math.max(0, totalOwedCents - totalPaidCents),
    });
  });
}
