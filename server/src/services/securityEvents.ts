import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { AppDb } from '../db/pool.js';
import {
  devices,
  otpChallenges,
  securityEvents,
  securityLockdowns,
  sessions,
} from '../db/schema.js';
import { Notifier } from '../providers/notifier.js';

export type SecuritySeverity = 'TIER_1' | 'TIER_2' | 'TIER_3';

export async function recordSecurityEvent(
  db: AppDb,
  params: {
    masterId?: string | null;
    eventType: string;
    severity: SecuritySeverity;
    actorType?: string | null;
    actorId?: string | null;
    deviceId?: string | null;
    phoneE164?: string | null;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(securityEvents).values({
    masterId: params.masterId ?? null,
    eventType: params.eventType,
    severity: params.severity,
    actorType: params.actorType ?? null,
    actorId: params.actorId ?? null,
    deviceId: params.deviceId ?? null,
    phoneE164: params.phoneE164 ?? null,
    details: params.details ?? {},
  });
}

export async function isStoreLockedDown(db: AppDb, masterId: string): Promise<boolean> {
  const rows = await db
    .select({ id: securityLockdowns.id })
    .from(securityLockdowns)
    .where(and(eq(securityLockdowns.masterId, masterId), eq(securityLockdowns.isActive, true)))
    .limit(1);
  return rows.length > 0;
}

export async function checkOtpRequestRateLimit(
  db: AppDb,
  params: { phoneE164: string; masterId?: string | null }
): Promise<{ allowed: boolean; recentCount: number }> {
  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.phoneE164, params.phoneE164),
        gte(otpChallenges.createdAt, windowStart)
      )
    );
  const recentCount = Number(row?.count ?? 0);
  if (recentCount >= 5) {
    await recordSecurityEvent(db, {
      masterId: params.masterId ?? null,
      eventType: 'OTP_FLOOD_RATE_LIMITED',
      severity: 'TIER_2',
      phoneE164: params.phoneE164,
      details: { recentCount, windowMinutes: 15 },
    });
    return { allowed: false, recentCount };
  }
  return { allowed: true, recentCount };
}

export async function recordFailedPassphraseAttempt(
  db: AppDb,
  params: {
    masterId?: string | null;
    salespersonId?: string | null;
    phoneE164: string;
    deviceId?: string | null;
    notifier?: Notifier;
  }
): Promise<{ lockedOut: boolean; recentFailures: number }> {
  await recordSecurityEvent(db, {
    masterId: params.masterId ?? null,
    eventType: 'LOGIN_FAILED_PASSPHRASE',
    severity: 'TIER_1',
    actorType: params.salespersonId ? 'SELLER' : 'ANONYMOUS',
    actorId: params.salespersonId ?? null,
    deviceId: params.deviceId ?? null,
    phoneE164: params.phoneE164,
    details: {},
  });

  if (!params.salespersonId || !params.masterId) {
    // Anonymous failures never trigger store lockdown or account lockout
    return { lockedOut: false, recentFailures: 0 };
  }

  const windowStart = new Date(Date.now() - 15 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(securityEvents)
    .where(
      and(
        eq(securityEvents.masterId, params.masterId),
        eq(securityEvents.actorId, params.salespersonId),
        eq(securityEvents.eventType, 'LOGIN_FAILED_PASSPHRASE'),
        gte(securityEvents.createdAt, windowStart)
      )
    );

  const recentFailures = Number(row?.count ?? 0);
  if (recentFailures >= 5) {
    // Tier 2 containment: revoke seller's sessions only (never store lockdown)
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.salespersonId, params.salespersonId), isNull(sessions.revokedAt)));

    await recordSecurityEvent(db, {
      masterId: params.masterId,
      eventType: 'SELLER_LOGIN_BURST_REVOKED',
      severity: 'TIER_2',
      actorType: 'SELLER',
      actorId: params.salespersonId,
      deviceId: params.deviceId ?? null,
      phoneE164: params.phoneE164,
      details: { recentFailures },
    });

    if (params.notifier) {
      await params.notifier.notify({
        type: 'SELLER_LOGIN_BURST_REVOKED',
        masterId: params.masterId,
        targetUserType: 'MASTER',
        title: 'Security Alert: Seller Login Burst',
        body: `Multiple failed logins for ${params.phoneE164}. Seller sessions revoked.`,
        data: { eventType: 'SELLER_LOGIN_BURST_REVOKED', salespersonId: params.salespersonId },
      });
    }
    return { lockedOut: true, recentFailures };
  }

  return { lockedOut: false, recentFailures };
}

export async function handleRefreshTokenReuse(
  db: AppDb,
  params: {
    masterId: string;
    salespersonId: string;
    deviceId: string;
    sessionId: string;
    notifier?: Notifier;
  }
): Promise<void> {
  const now = new Date();
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.salespersonId, params.salespersonId), isNull(sessions.revokedAt)));

  await db
    .update(devices)
    .set({ blockedAt: now })
    .where(eq(devices.id, params.deviceId));

  await recordSecurityEvent(db, {
    masterId: params.masterId,
    eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
    severity: 'TIER_2',
    actorType: 'SELLER',
    actorId: params.salespersonId,
    deviceId: params.deviceId,
    details: { sessionId: params.sessionId },
  });

  if (params.notifier) {
    await params.notifier.notify({
      type: 'REFRESH_TOKEN_REUSE_DETECTED',
      masterId: params.masterId,
      targetUserType: 'MASTER',
      title: 'Security Alert: Token Reuse Detected',
      body: 'A revoked refresh token was reused. Seller sessions revoked and device blocked.',
      data: {
        eventType: 'REFRESH_TOKEN_REUSE_DETECTED',
        salespersonId: params.salespersonId,
        deviceId: params.deviceId,
      },
    });
  }
}
