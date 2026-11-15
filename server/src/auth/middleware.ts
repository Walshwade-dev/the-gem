import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import type { AppDb } from '../db/pool.js';
import {
  devices,
  masters,
  salespeople,
  securityLockdowns,
  sessions,
  stockAssignments,
} from '../db/schema.js';
import {
  type ClerkTokenVerifier,
  verifySellerAccessToken,
} from './tokens.js';

export interface AuthContext {
  role: 'MERCHANT' | 'SELLER';
  actorType: 'MASTER' | 'SELLER';
  userId: string;
  masterId: string;
  fullName: string;
  deviceId?: string;
  sessionId?: string;
  clerkAuthAgeSec?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export function createAuthMiddleware(opts: {
  db: AppDb;
  clerkVerifier: ClerkTokenVerifier;
  sellerJwtSecret: string;
}) {
  const { db, clerkVerifier, sellerJwtSecret } = opts;

  return async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing Authorization Bearer token' });
    }
    const token = authHeader.slice(7).trim();
    const tokenHint = request.headers['x-auth-type']; // 'clerk' | 'seller' optional hint

    // 1. Try Seller JWT if hinted or if Clerk fails
    if (tokenHint !== 'clerk') {
      try {
        const sellerClaims = await verifySellerAccessToken(token, sellerJwtSecret);
        // Check salesperson status, session, device, lockdown, and >= 1 ACTIVE assignment on EVERY request
        const [seller] = await db
          .select()
          .from(salespeople)
          .where(eq(salespeople.id, sellerClaims.sub))
          .limit(1);

        if (!seller || seller.status !== 'ACTIVE') {
          return reply.code(403).send({ error: 'Salesperson account is not ACTIVE' });
        }

        const [session] = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.id, sellerClaims.sessionId),
              eq(sessions.salespersonId, seller.id),
              isNull(sessions.revokedAt)
            )
          )
          .limit(1);

        if (!session || session.expiresAt < new Date()) {
          return reply.code(401).send({ error: 'Session expired or revoked' });
        }

        const [dev] = await db
          .select()
          .from(devices)
          .where(eq(devices.id, sellerClaims.deviceId))
          .limit(1);

        if (!dev || dev.blockedAt !== null) {
          return reply.code(403).send({ error: 'Device is blocked' });
        }

        const [lockdown] = await db
          .select()
          .from(securityLockdowns)
          .where(
            and(
              eq(securityLockdowns.masterId, seller.masterId),
              eq(securityLockdowns.isActive, true)
            )
          )
          .limit(1);

        if (lockdown) {
          return reply.code(403).send({ error: 'Store is currently in security lockdown' });
        }

        const [activeAssignment] = await db
          .select({ id: stockAssignments.id })
          .from(stockAssignments)
          .where(
            and(
              eq(stockAssignments.salespersonId, seller.id),
              eq(stockAssignments.status, 'ACTIVE')
            )
          )
          .limit(1);

        if (!activeAssignment) {
          return reply.code(403).send({
            error: 'No ACTIVE stock assignment. Access exists only while holding an active assignment.',
          });
        }

        request.auth = {
          role: 'SELLER',
          actorType: 'SELLER',
          userId: seller.id,
          masterId: seller.masterId,
          fullName: seller.fullName,
          deviceId: dev.id,
          sessionId: session.id,
        };
        return;
      } catch {
        if (tokenHint === 'seller') {
          return reply.code(401).send({ error: 'Invalid seller access token' });
        }
      }
    }

    // 2. Try Clerk JWT (Master)
    try {
      const verified = await clerkVerifier(token);
      const [master] = await db
        .select()
        .from(masters)
        .where(eq(masters.clerkUserId, verified.clerkUserId))
        .limit(1);

      if (!master) {
        return reply.code(403).send({ error: 'Master account not synced. Call POST /auth/master/sync first.' });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const authAge = verified.authTimeEpochSec ? nowSec - verified.authTimeEpochSec : undefined;

      request.auth = {
        role: 'MERCHANT',
        actorType: 'MASTER',
        userId: master.id,
        masterId: master.id,
        fullName: master.fullName,
        clerkAuthAgeSec: authAge,
      };
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired authentication token' });
    }
  };
}

export async function requireMaster(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth || request.auth.role !== 'MERCHANT') {
    return reply.code(403).send({ error: 'Master (MERCHANT) role required' });
  }
}

export async function requireStepUpMfa(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth || request.auth.role !== 'MERCHANT') {
    return reply.code(403).send({ error: 'Master role required' });
  }
  const age = request.auth.clerkAuthAgeSec;
  if (age === undefined || age > 300) {
    return reply.code(403).send({
      error: 'Step-up MFA required: please re-authenticate via Clerk within the last 5 minutes.',
      code: 'STEP_UP_REQUIRED',
    });
  }
}
