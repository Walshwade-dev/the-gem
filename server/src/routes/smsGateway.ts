import { FastifyInstance } from 'fastify';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuthMiddleware, requireMaster } from '../auth/middleware.js';
import { smsOutbox } from '../db/schema.js';
import { AppRouteDeps } from './types.js';

const AckBody = z.object({
  id: z.string().uuid(),
  status: z.enum(['SENT', 'FAILED']),
  error: z.string().optional(),
});

const SendBody = z.object({
  toPhoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Valid E.164 phone required'),
  bodyText: z.string().min(1).max(640),
  template: z.string().min(1).max(64).default('MANUAL_GATEWAY'),
});

export async function registerSmsGatewayRoutes(app: FastifyInstance, deps: AppRouteDeps): Promise<void> {
  const { db, config, clerkVerifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // GET /sms-gateway/outbox — Fetch QUEUED SMS messages for Master's Android SIM Gateway
  app.get(
    '/sms-gateway/outbox',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const auth = request.auth!;
      const rows = await db
        .select({
          id: smsOutbox.id,
          toPhoneE164: smsOutbox.toPhoneE164,
          bodyText: smsOutbox.bodyText,
          template: smsOutbox.template,
          createdAt: smsOutbox.createdAt,
        })
        .from(smsOutbox)
        .where(and(eq(smsOutbox.masterId, auth.masterId), eq(smsOutbox.status, 'QUEUED')))
        .orderBy(asc(smsOutbox.createdAt))
        .limit(20);

      return reply.send({ messages: rows });
    }
  );

  // POST /sms-gateway/ack — Mark a queued SMS as SENT or FAILED after Android SIM dispatch
  app.post(
    '/sms-gateway/ack',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const auth = request.auth!;
      const body = AckBody.parse(request.body);

      const [existing] = await db
        .select()
        .from(smsOutbox)
        .where(and(eq(smsOutbox.id, body.id), eq(smsOutbox.masterId, auth.masterId)))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: 'SMS outbox item not found' });
      }

      const [updated] = await db
        .update(smsOutbox)
        .set({
          status: body.status,
          attempts: existing.attempts + 1,
          providerMessageId: body.status === 'SENT' ? 'android-sim-gateway' : null,
          sentAt: body.status === 'SENT' ? new Date() : null,
        })
        .where(eq(smsOutbox.id, existing.id))
        .returning();

      return reply.send({ ok: true, id: updated.id, status: updated.status });
    }
  );

  // POST /sms-gateway/send — Queue a custom/test SMS for the Master Android SIM Gateway
  app.post(
    '/sms-gateway/send',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const auth = request.auth!;
      const body = SendBody.parse(request.body);

      const [inserted] = await db
        .insert(smsOutbox)
        .values({
          masterId: auth.masterId,
          toPhoneE164: body.toPhoneE164,
          template: body.template,
          payload: { source: 'sms-gateway-send' },
          bodyText: body.bodyText,
          status: 'QUEUED',
        })
        .returning({
          id: smsOutbox.id,
          toPhoneE164: smsOutbox.toPhoneE164,
          status: smsOutbox.status,
          createdAt: smsOutbox.createdAt,
        });

      return reply.code(201).send({ ok: true, message: inserted });
    }
  );

  // GET /sms-gateway/status — Return outbox queue counts for the Master's SIM Gateway
  app.get(
    '/sms-gateway/status',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const auth = request.auth!;
      const rows = await db
        .select({ status: smsOutbox.status })
        .from(smsOutbox)
        .where(eq(smsOutbox.masterId, auth.masterId));

      let queued = 0;
      let sent = 0;
      let failed = 0;
      for (const r of rows) {
        if (r.status === 'QUEUED') queued++;
        else if (r.status === 'SENT') sent++;
        else if (r.status === 'FAILED') failed++;
      }

      return reply.send({ queued, sent, failed, total: rows.length });
    }
  );
}
