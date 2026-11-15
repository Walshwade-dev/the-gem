import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { AppConfig } from '../config.js';
import { AppDb } from '../db/pool.js';
import { mpesaStkRequests } from '../db/schema.js';
import { ClerkTokenVerifier } from '../auth/tokens.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { writeAuditEvent } from '../services/audit.js';

export interface MpesaRouteDeps {
  db: AppDb;
  config: AppConfig;
  clerkVerifier: ClerkTokenVerifier;
}

const StkPushBody = z.object({
  phoneNumber: z.string().min(9),
  amountKsh: z.number().positive(),
  batchId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
});

function normalizeKenyaPhone(raw: string): { e164: string; intasend: string } {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return { e164: `+${digits}`, intasend: digits };
  }
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) {
    const intl = `254${digits.slice(1)}`;
    return { e164: `+${intl}`, intasend: intl };
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    const intl = `254${digits}`;
    return { e164: `+${intl}`, intasend: intl };
  }
  throw Object.assign(new Error('Enter a valid Kenyan phone number (e.g. 0712345678)'), {
    statusCode: 400,
    code: 'INVALID_PHONE',
  });
}

function getIntasendBaseUrl(secretKey: string): string {
  return secretKey.startsWith('ISSecretKey_test_')
    ? 'https://sandbox.intasend.com/api/v1'
    : 'https://payment.intasend.com/api/v1';
}

function mapIntasendState(rawState?: string | null): 'PENDING' | 'PROCESSING' | 'COMPLETE' | 'FAILED' {
  const upper = (rawState ?? '').toUpperCase();
  if (upper === 'COMPLETE' || upper === 'COMPLETED') return 'COMPLETE';
  if (upper === 'FAILED' || upper === 'CANCELLED') return 'FAILED';
  if (upper === 'PROCESSING') return 'PROCESSING';
  return 'PENDING';
}

export async function registerMpesaRoutes(app: FastifyInstance, deps: MpesaRouteDeps): Promise<void> {
  const { db, config, clerkVerifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // POST /mpesa/stk-push — Initiates an IntaSend M-Pesa STK Push to customer phone
  app.post('/mpesa/stk-push', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = request.auth!;
    const body = StkPushBody.parse(request.body);
    const secretKey = config.INTASEND_SECRET_KEY?.trim();

    if (!secretKey) {
      return reply.code(503).send({
        error: 'MPESA_NOT_CONFIGURED',
        message: 'IntaSend STK Push is not configured yet. Add INTASEND_SECRET_KEY on the server.',
      });
    }

    const phone = normalizeKenyaPhone(body.phoneNumber);
    const amountKsh = Math.max(1, Math.round(body.amountKsh));
    const apiRef = `gem-${crypto.randomUUID().slice(0, 12)}`;
    const baseUrl = getIntasendBaseUrl(secretKey);

    const upstream = await fetch(`${baseUrl}/payment/mpesa-stk-push/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountKsh,
        phone_number: phone.intasend,
        api_ref: apiRef,
      }),
    });

    const data = (await upstream.json().catch(() => ({}))) as {
      id?: string;
      invoice?: {
        invoice_id?: string;
        state?: string;
        mpesa_reference?: string;
      };
      errors?: Array<{ detail?: string }>;
      detail?: string;
    };

    if (!upstream.ok) {
      const detail = data?.errors?.[0]?.detail || data?.detail || 'IntaSend STK Push request failed';
      return reply.code(502).send({
        error: 'INTASEND_UPSTREAM_ERROR',
        message: detail,
      });
    }

    const invoiceId = data.invoice?.invoice_id ?? data.id ?? null;
    const status = mapIntasendState(data.invoice?.state);

    const [created] = await db
      .insert(mpesaStkRequests)
      .values({
        masterId: auth.masterId,
        batchId: body.batchId ?? null,
        assignmentId: body.assignmentId ?? null,
        initiatedByType: auth.role === 'MERCHANT' ? 'MASTER' : 'SELLER',
        initiatedById: auth.userId,
        provider: 'INTASEND',
        invoiceId,
        apiRef,
        phoneE164: phone.e164,
        amountCents: amountKsh * 100,
        status,
        mpesaReceipt: data.invoice?.mpesa_reference ?? null,
        rawResponse: data,
      })
      .returning();

    await writeAuditEvent(db, {
      masterId: auth.masterId,
      actorType: auth.role === 'MERCHANT' ? 'MASTER' : 'SELLER',
      actorId: auth.userId,
      action: 'STK_PUSH_INITIATED',
      outcome: 'SUCCESS',
      entityType: 'mpesa_stk_request',
      entityId: created.id,
      afterState: {
        invoiceId,
        apiRef,
        phoneE164: phone.e164,
        amountKsh,
        status,
      },
    });

    return reply.code(201).send({
      requestId: created.id,
      invoiceId,
      apiRef,
      status,
      phoneE164: phone.e164,
      amountKsh,
    });
  });

  // GET /mpesa/stk-status/:id — Polls IntaSend status and returns latest STK state & M-Pesa receipt
  app.get('/mpesa/stk-status/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };

    const [row] = await db
      .select()
      .from(mpesaStkRequests)
      .where(and(eq(mpesaStkRequests.id, id), eq(mpesaStkRequests.masterId, auth.masterId)))
      .limit(1);

    if (!row) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'STK request not found' });
    }

    const secretKey = config.INTASEND_SECRET_KEY?.trim();
    if ((row.status === 'PENDING' || row.status === 'PROCESSING') && row.invoiceId && secretKey) {
      try {
        const baseUrl = getIntasendBaseUrl(secretKey);
        const upstream = await fetch(`${baseUrl}/payment/status/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoice_id: row.invoiceId }),
        });

        if (upstream.ok) {
          const data = (await upstream.json().catch(() => ({}))) as {
            invoice?: {
              state?: string;
              mpesa_reference?: string | null;
              failed_code?: string | null;
              failed_reason?: string | null;
            };
          };
          const nextStatus = mapIntasendState(data.invoice?.state);
          const nextReceipt = data.invoice?.mpesa_reference ?? row.mpesaReceipt;
          const nextFailedCode = data.invoice?.failed_code ?? row.failedCode;
          const nextFailedReason = data.invoice?.failed_reason ?? row.failedReason;

          if (
            nextStatus !== row.status ||
            nextReceipt !== row.mpesaReceipt ||
            nextFailedReason !== row.failedReason
          ) {
            const [updated] = await db
              .update(mpesaStkRequests)
              .set({
                status: nextStatus,
                mpesaReceipt: nextReceipt,
                failedCode: nextFailedCode,
                failedReason: nextFailedReason,
                rawResponse: data,
                updatedAt: new Date(),
              })
              .where(eq(mpesaStkRequests.id, row.id))
              .returning();

            return reply.send({
              requestId: updated.id,
              invoiceId: updated.invoiceId,
              status: updated.status,
              mpesaReceipt: updated.mpesaReceipt,
              failedCode: updated.failedCode,
              failedReason: updated.failedReason,
              phoneE164: updated.phoneE164,
              amountKsh: Math.round(updated.amountCents / 100),
            });
          }
        }
      } catch {
        // Return current DB state if upstream poll temporarily fails
      }
    }

    return reply.send({
      requestId: row.id,
      invoiceId: row.invoiceId,
      status: row.status,
      mpesaReceipt: row.mpesaReceipt,
      failedCode: row.failedCode,
      failedReason: row.failedReason,
      phoneE164: row.phoneE164,
      amountKsh: Math.round(row.amountCents / 100),
    });
  });

  // POST /mpesa/intasend-webhook — Receives IntaSend payment callbacks with challenge verification
  app.post('/mpesa/intasend-webhook', async (request, reply) => {
    const expectedChallenge = config.INTASEND_WEBHOOK_CHALLENGE?.trim();
    const payload = (request.body ?? {}) as {
      challenge?: string;
      invoice_id?: string;
      api_ref?: string;
      state?: string;
      mpesa_reference?: string;
      failed_code?: string;
      failed_reason?: string;
    };

    if (!expectedChallenge || !payload.challenge || payload.challenge !== expectedChallenge) {
      return reply.code(403).send({ error: 'INVALID_CHALLENGE', message: 'Invalid webhook challenge' });
    }

    const matchConditions = [
      payload.invoice_id ? eq(mpesaStkRequests.invoiceId, payload.invoice_id) : undefined,
      payload.api_ref ? eq(mpesaStkRequests.apiRef, payload.api_ref) : undefined,
    ].filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (matchConditions.length > 0) {
      const [existing] = await db
        .select()
        .from(mpesaStkRequests)
        .where(matchConditions.length > 1 ? or(...matchConditions) : matchConditions[0])
        .limit(1);

      if (existing) {
        await db
          .update(mpesaStkRequests)
          .set({
            status: mapIntasendState(payload.state),
            mpesaReceipt: payload.mpesa_reference ?? existing.mpesaReceipt,
            failedCode: payload.failed_code ?? existing.failedCode,
            failedReason: payload.failed_reason ?? existing.failedReason,
            rawResponse: payload,
            updatedAt: new Date(),
          })
          .where(eq(mpesaStkRequests.id, existing.id));
      }
    }

    return reply.code(200).send({ ok: true });
  });
}
