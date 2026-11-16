import { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { Webhook } from 'svix';
import { z } from 'zod';
import { createClerkClient } from '@clerk/backend';
import {
  devices,
  expenseCategories,
  masters,
  nccTariffs,
  otpChallenges,
  pushTokens,
  recurringDailyExpenses,
  salespeople,
  securityEvents,
  securityLockdowns,
  sessions,
  shrinkageConfig,
  smsOutbox,
  stockAssignments,
  termsAcceptances,
} from '../db/schema.js';
import { SimGatewaySmsProvider } from '../providers/sms.js';
import {
  generateRandomToken,
  generateSixDigitOtp,
  hashPassphrase,
  sha256Hex,
  signSellerAccessToken,
  verifyPassphrase,
} from '../auth/tokens.js';
import { createAuthMiddleware, requireMaster, requireStepUpMfa } from '../auth/middleware.js';
import { normalizeKenyaPhoneToE164 } from '../utils/phone.js';
import { getNairobiBusinessDate } from '../utils/time.js';
import { writeAuditEvent } from '../services/audit.js';
import {
  checkOtpRequestRateLimit,
  handleRefreshTokenReuse,
  isStoreLockedDown,
  recordFailedPassphraseAttempt,
  recordSecurityEvent,
} from '../services/securityEvents.js';
import { AppRouteDeps, sendValidationError } from './types.js';

const SYSTEM_EXPENSE_CATEGORIES = [
  { code: 'NCC_CESS', label: 'NCC Cess & Market Fee', isSystem: true },
  { code: 'WATCHMAN', label: 'Watchman', isSystem: true },
  { code: 'CLEANERS_SWEEPERS', label: 'Cleaners / Sweepers', isSystem: true },
  { code: 'OFFLOADERS', label: 'Offloaders', isSystem: false },
  { code: 'BROKERS', label: 'Brokers', isSystem: false },
  { code: 'CASUAL_LABOR', label: 'Casual Labor', isSystem: false },
  { code: 'FOOD_WATER', label: 'Food & Water', isSystem: false },
  { code: 'TRANSPORT', label: 'Transport', isSystem: false },
  { code: 'PACKAGING', label: 'Packaging / Nets', isSystem: false },
  { code: 'OTHER', label: 'Other Expense', isSystem: false },
];

export async function seedMasterDefaults(db: AppRouteDeps['db'], masterId: string) {
  const today = getNairobiBusinessDate();
  const existingTariff = await db
    .select({ id: nccTariffs.id })
    .from(nccTariffs)
    .where(eq(nccTariffs.masterId, masterId))
    .limit(1);
  if (existingTariff.length === 0) {
    await db.insert(nccTariffs).values({
      masterId,
      ratePerNetCents: 2000,
      discountCents: 200000,
      minPayableCents: 600000,
      dailyFeeCents: 100000,
      defaultMaxDays: 4,
      effectiveFrom: today,
    });
  }

  const existingShrink = await db
    .select({ id: shrinkageConfig.id })
    .from(shrinkageConfig)
    .where(eq(shrinkageConfig.masterId, masterId))
    .limit(1);
  if (existingShrink.length === 0) {
    await db.insert(shrinkageConfig).values({
      masterId,
      lossPerNetPerDayG: 200,
      floorPerNetG: 18000,
      extraTolerancePercent: '0.50',
      effectiveFrom: today,
    });
  }

  const existingRec = await db
    .select({ id: recurringDailyExpenses.id })
    .from(recurringDailyExpenses)
    .where(eq(recurringDailyExpenses.masterId, masterId))
    .limit(1);
  if (existingRec.length === 0) {
    await db.insert(recurringDailyExpenses).values([
      { masterId, categoryCode: 'WATCHMAN', amountCents: 10000, isActive: true },
      { masterId, categoryCode: 'CLEANERS_SWEEPERS', amountCents: 10000, isActive: true },
    ]);
  }

  for (const cat of SYSTEM_EXPENSE_CATEGORIES) {
    await db
      .insert(expenseCategories)
      .values({ masterId, code: cat.code, label: cat.label, isSystem: cat.isSystem })
      .onConflictDoNothing();
  }
}

export async function registerAuthRoutes(app: FastifyInstance, deps: AppRouteDeps) {
  const { db, config, clerkVerifier, smsProvider, notifier } = deps;
  const authenticate = createAuthMiddleware({
    db,
    clerkVerifier,
    sellerJwtSecret: config.SELLER_JWT_SECRET,
  });

  // POST /auth/master/sync - verifies Clerk JWT directly & creates/updates Master or Salesperson row
  app.post('/auth/master/sync', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'UNAUTHORIZED' });
    }
    const parsed = z
      .object({
        email: z.string().email().optional(),
        fullName: z.string().min(1).optional(),
        storeName: z.string().min(1).optional(),
        phoneE164: z.string().optional(),
        nationalId: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    let verified;
    try {
      verified = await clerkVerifier(authHeader.slice(7).trim());
    } catch {
      return reply.code(401).send({ error: 'INVALID_TOKEN' });
    }

    // 1. Check if user is an existing salesperson
    const [existingSeller] = await db
      .select()
      .from(salespeople)
      .where(eq(salespeople.clerkUserId, verified.clerkUserId))
      .limit(1);

    if (existingSeller) {
      let seller = existingSeller;
      if (parsed.data.fullName || parsed.data.email) {
        const [updated] = await db
          .update(salespeople)
          .set({
            fullName: parsed.data.fullName ?? seller.fullName,
            email: parsed.data.email ?? seller.email,
          })
          .where(eq(salespeople.id, seller.id))
          .returning();
        seller = updated;
      }
      return reply.send({ role: 'SELLER', salesperson: seller });
    }

    // 2. Check if Clerk public metadata defines role === 'SELLER'
    if (config.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });
        const clerkUser = await clerk.users.getUser(verified.clerkUserId);
        const metaRole = (clerkUser.publicMetadata as { role?: string })?.role;
        const metaMasterId = (clerkUser.publicMetadata as { masterId?: string })?.masterId;
        if (metaRole === 'SELLER') {
          let targetMasterId = metaMasterId;
          if (!targetMasterId) {
            const [anyMaster] = await db.select({ id: masters.id }).from(masters).limit(1);
            targetMasterId = anyMaster?.id;
          }
          if (targetMasterId) {
            const [createdSeller] = await db
              .insert(salespeople)
              .values({
                masterId: targetMasterId,
                clerkUserId: verified.clerkUserId,
                email: parsed.data.email ?? `${verified.clerkUserId}@clerk.local`,
                fullName:
                  parsed.data.fullName ??
                  ([clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
                    'Sales Agent'),
                phoneE164: parsed.data.phoneE164
                  ? normalizeKenyaPhoneToE164(parsed.data.phoneE164)
                  : `+2547${Math.floor(10000000 + Math.random() * 90000000)}`,
                status: 'ACTIVE',
              })
              .returning();
            return reply.send({ role: 'SELLER', salesperson: createdSeller });
          }
        }
      } catch {
        // Fallback to master sync
      }
    }

    // 3. User is a Master Admin (MERCHANT)
    const [existing] = await db
      .select()
      .from(masters)
      .where(eq(masters.clerkUserId, verified.clerkUserId))
      .limit(1);

    let master = existing;
    if (!master) {
      const [created] = await db
        .insert(masters)
        .values({
          clerkUserId: verified.clerkUserId,
          email: parsed.data.email ?? `${verified.clerkUserId}@clerk.local`,
          fullName: parsed.data.fullName ?? 'Store Master',
          storeName: parsed.data.storeName ?? 'Onion Store',
          phoneE164: parsed.data.phoneE164 ? normalizeKenyaPhoneToE164(parsed.data.phoneE164) : null,
          nationalId: parsed.data.nationalId ?? null,
        })
        .returning();
      master = created;
      await seedMasterDefaults(db, master.id);
    } else if (parsed.data.fullName || parsed.data.storeName || parsed.data.email) {
      const [updated] = await db
        .update(masters)
        .set({
          email: parsed.data.email ?? master.email,
          fullName: parsed.data.fullName ?? master.fullName,
          storeName: parsed.data.storeName ?? master.storeName,
        })
        .where(eq(masters.id, master.id))
        .returning();
      master = updated;
    }

    return reply.send({ role: 'MERCHANT', master });
  });

  // POST /auth/clerk/create-user - Master provisions a new Clerk user with chosen role
  app.post(
    '/auth/clerk/create-user',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      if (!config.CLERK_SECRET_KEY) {
        return reply.code(503).send({
          error: 'CLERK_SECRET_NOT_CONFIGURED',
          message: 'Backend Clerk secret key is not configured.',
        });
      }

      const parsed = z
        .object({
          email: z.string().email('Valid email is required'),
          password: z.string().min(8, 'Password must be at least 8 characters long'),
          fullName: z.string().min(1, 'Full name is required'),
          role: z.enum(['MERCHANT', 'SELLER']),
          phoneE164: z.string().optional(),
        })
        .safeParse(request.body);

      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const { email, password, fullName, role, phoneE164 } = parsed.data;
      const clerk = createClerkClient({ secretKey: config.CLERK_SECRET_KEY });

      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || undefined;

      let clerkUser;
      try {
        clerkUser = await clerk.users.createUser({
          emailAddress: [email.trim().toLowerCase()],
          password: password.trim(),
          firstName,
          lastName,
          publicMetadata: {
            role,
            masterId: request.auth!.masterId,
            createdById: request.auth!.userId,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (err: any) {
        const clerkErrors = err?.errors;
        const msg =
          Array.isArray(clerkErrors) && clerkErrors.length > 0
            ? clerkErrors.map((e: any) => e.longMessage || e.message).join('; ')
            : err instanceof Error
              ? err.message
              : 'Failed to create user in Clerk';
        return reply.code(400).send({
          error: 'CLERK_CREATE_USER_FAILED',
          message: msg,
        });
      }

      const normalizedPhone = phoneE164
        ? normalizeKenyaPhoneToE164(phoneE164)
        : null;

      if (role === 'MERCHANT') {
        const [existingMaster] = await db
          .select()
          .from(masters)
          .where(eq(masters.clerkUserId, clerkUser.id))
          .limit(1);

        if (!existingMaster) {
          const [newMaster] = await db
            .insert(masters)
            .values({
              clerkUserId: clerkUser.id,
              email: email.trim().toLowerCase(),
              fullName: fullName.trim(),
              storeName: 'Onion Store',
              phoneE164: normalizedPhone,
            })
            .returning();
          await seedMasterDefaults(db, newMaster.id);
        }
      } else {
        // role === 'SELLER'
        const sellerPhone =
          normalizedPhone || `+2547${Math.floor(10000000 + Math.random() * 90000000)}`;

        const [existingSeller] = await db
          .select()
          .from(salespeople)
          .where(eq(salespeople.clerkUserId, clerkUser.id))
          .limit(1);

        if (!existingSeller) {
          await db
            .insert(salespeople)
            .values({
              masterId: request.auth!.masterId,
              clerkUserId: clerkUser.id,
              email: email.trim().toLowerCase(),
              phoneE164: sellerPhone,
              fullName: fullName.trim(),
              status: 'ACTIVE',
            });
        }
      }

      await writeAuditEvent(db, {
        masterId: request.auth!.masterId,
        actorType: 'MASTER',
        actorId: request.auth!.userId,
        action: 'CLERK_USER_PROVISIONED',
        entityType: 'CLERK_USER',
        entityId: clerkUser.id,
        afterState: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          role,
          clerkUserId: clerkUser.id,
        },
        outcome: 'SUCCESS',
      });

      return reply.send({
        success: true,
        message: `Account created successfully in Clerk for ${fullName} (${role === 'MERCHANT' ? 'Master Admin' : 'Sales Agent'}).`,
        user: {
          id: clerkUser.id,
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          role,
        },
      });
    }
  );

  // POST /webhooks/clerk - Svix webhook verification
  app.post('/webhooks/clerk', async (request, reply) => {
    if (!config.CLERK_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: 'WEBHOOK_SECRET_NOT_CONFIGURED' });
    }
    const svixId = request.headers['svix-id'] as string | undefined;
    const svixTimestamp = request.headers['svix-timestamp'] as string | undefined;
    const svixSignature = request.headers['svix-signature'] as string | undefined;
    if (!svixId || !svixTimestamp || !svixSignature) {
      return reply.code(400).send({ error: 'MISSING_SVIX_HEADERS' });
    }

    const wh = new Webhook(config.CLERK_WEBHOOK_SECRET);
    let evt: { type: string; data: Record<string, unknown> };
    try {
      evt = wh.verify(JSON.stringify(request.body), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as { type: string; data: Record<string, unknown> };
    } catch {
      return reply.code(400).send({ error: 'INVALID_WEBHOOK_SIGNATURE' });
    }

    await recordSecurityEvent(db, {
      eventType: `CLERK_WEBHOOK_${evt.type.toUpperCase()}`,
      severity: 'TIER_1',
      details: { clerkUserId: evt.data?.id ?? null },
    });

    return reply.send({ received: true });
  });

  // POST /auth/seller/otp/request
  app.post('/auth/seller/otp/request', async (request, reply) => {
    const parsed = z
      .object({
        phoneE164: z.string().min(9),
        purpose: z.enum(['INVITE', 'LOGIN', 'RESET_PASSPHRASE']).default('LOGIN'),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    let phoneE164: string;
    try {
      phoneE164 = normalizeKenyaPhoneToE164(parsed.data.phoneE164);
    } catch {
      return reply.code(400).send({ error: 'INVALID_KENYA_PHONE' });
    }

    const [seller] = await db
      .select()
      .from(salespeople)
      .where(eq(salespeople.phoneE164, phoneE164))
      .limit(1);

    const rate = await checkOtpRequestRateLimit(db, {
      phoneE164,
      masterId: seller?.masterId ?? null,
    });
    if (!rate.allowed) {
      return reply.code(429).send({ error: 'OTP_RATE_LIMITED' });
    }

    if (!seller || seller.status === 'REVOKED' || seller.status === 'SUSPENDED') {
      // Do not reveal account existence
      return reply.send({ ok: true, message: 'If eligible, an OTP has been sent.' });
    }

    const code = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(otpChallenges).values({
      masterId: seller.masterId,
      phoneE164,
      codeHash: sha256Hex(code),
      purpose: parsed.data.purpose,
      expiresAt,
      maxAttempts: 5,
    });

    const otpMsg = `THE GEM — SELLER LOGIN CODE\nYour one-time login code is: ${code}\nExpires in 5 minutes.`;
    if (smsProvider instanceof SimGatewaySmsProvider) {
      await db.insert(smsOutbox).values({
        masterId: seller.masterId,
        toPhoneE164: phoneE164,
        template: 'SELLER_OTP_LOGIN',
        payload: { purpose: parsed.data.purpose },
        bodyText: otpMsg,
        status: 'QUEUED',
      });
    } else {
      await smsProvider.send(phoneE164, otpMsg);
    }

    return reply.send({ ok: true, message: 'If eligible, an OTP has been sent.' });
  });

  // POST /auth/seller/invite-code - Master generates a 6-digit login code for an assigned seller (no SMS required)
  app.post(
    '/auth/seller/invite-code',
    { preHandler: [authenticate, requireMaster] },
    async (request, reply) => {
      const parsed = z
        .object({
          phoneE164: z.string().min(9),
        })
        .safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      let phoneE164: string;
      try {
        phoneE164 = normalizeKenyaPhoneToE164(parsed.data.phoneE164);
      } catch {
        return reply.code(400).send({ error: 'INVALID_KENYA_PHONE' });
      }

      const masterId = request.auth!.masterId;
      const [seller] = await db
        .select()
        .from(salespeople)
        .where(and(eq(salespeople.masterId, masterId), eq(salespeople.phoneE164, phoneE164)))
        .limit(1);

      if (!seller) {
        return reply.code(404).send({ error: 'SELLER_NOT_FOUND' });
      }
      if (seller.status === 'REVOKED' || seller.status === 'SUSPENDED') {
        return reply.code(403).send({ error: 'SELLER_INACTIVE' });
      }

      const code = generateSixDigitOtp();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.insert(otpChallenges).values({
        masterId,
        phoneE164,
        codeHash: sha256Hex(code),
        purpose: 'LOGIN',
        expiresAt,
        maxAttempts: 5,
      });

      const inviteMsg = `THE GEM — SELLER INVITE CODE\nHello ${seller.fullName}, your one-time login code is: ${code}\nValid for 24 hours.`;
      if (smsProvider instanceof SimGatewaySmsProvider) {
        await db.insert(smsOutbox).values({
          masterId,
          toPhoneE164: phoneE164,
          template: 'SELLER_INVITE_CODE',
          payload: { sellerId: seller.id, sellerName: seller.fullName },
          bodyText: inviteMsg,
          status: 'QUEUED',
        });
      } else {
        await smsProvider.send(phoneE164, inviteMsg);
      }

      await writeAuditEvent(db, {
        masterId,
        actorType: 'MASTER',
        actorId: request.auth!.userId,
        action: 'SELLER_INVITE_CODE_GENERATED',
        outcome: 'SUCCESS',
        entityType: 'salesperson',
        entityId: seller.id,
        afterState: { phoneE164, expiresAt: expiresAt.toISOString() },
      });

      return reply.send({
        ok: true,
        code,
        expiresAt: expiresAt.toISOString(),
        phoneE164,
        sellerName: seller.fullName,
      });
    }
  );

  // POST /auth/seller/otp/verify
  app.post('/auth/seller/otp/verify', async (request, reply) => {
    const parsed = z
      .object({
        phoneE164: z.string().min(9),
        code: z.string().length(6),
        purpose: z.enum(['INVITE', 'LOGIN', 'RESET_PASSPHRASE']).default('LOGIN'),
        deviceFingerprint: z.string().min(3),
        platform: z.string().optional(),
        passphrase: z.string().min(6).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    let phoneE164: string;
    try {
      phoneE164 = normalizeKenyaPhoneToE164(parsed.data.phoneE164);
    } catch {
      return reply.code(400).send({ error: 'INVALID_KENYA_PHONE' });
    }

    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.phoneE164, phoneE164),
          eq(otpChallenges.purpose, parsed.data.purpose),
          isNull(otpChallenges.consumedAt),
          gt(otpChallenges.expiresAt, new Date())
        )
      )
      .orderBy(desc(otpChallenges.createdAt))
      .limit(1);

    if (!challenge || challenge.attempts >= challenge.maxAttempts) {
      return reply.code(401).send({ error: 'OTP_INVALID_OR_EXPIRED' });
    }

    if (sha256Hex(parsed.data.code) !== challenge.codeHash) {
      await db
        .update(otpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(otpChallenges.id, challenge.id));
      await recordSecurityEvent(db, {
        masterId: challenge.masterId,
        eventType: 'OTP_VERIFY_FAILED',
        severity: 'TIER_1',
        phoneE164,
      });
      return reply.code(401).send({ error: 'OTP_INVALID_OR_EXPIRED' });
    }

    const [seller] = await db
      .select()
      .from(salespeople)
      .where(eq(salespeople.phoneE164, phoneE164))
      .limit(1);
    if (!seller || seller.status === 'REVOKED' || seller.status === 'SUSPENDED') {
      return reply.code(403).send({ error: 'SELLER_INACTIVE' });
    }

    if (await isStoreLockedDown(db, seller.masterId)) {
      return reply.code(403).send({ error: 'STORE_LOCKED_DOWN' });
    }

    const activeAssignments = await db
      .select({ id: stockAssignments.id })
      .from(stockAssignments)
      .where(
        and(eq(stockAssignments.salespersonId, seller.id), eq(stockAssignments.status, 'ACTIVE'))
      )
      .limit(1);
    if (activeAssignments.length === 0) {
      return reply.code(403).send({ error: 'NO_ACTIVE_ASSIGNMENT' });
    }

    await db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenges.id, challenge.id));

    let nextStatus = seller.status;
    if (parsed.data.passphrase) {
      const hash = await hashPassphrase(parsed.data.passphrase);
      await db
        .update(salespeople)
        .set({ passphraseHash: hash, status: 'ACTIVE' })
        .where(eq(salespeople.id, seller.id));
      nextStatus = 'ACTIVE';
    } else if (seller.status === 'INVITED') {
      await db
        .update(salespeople)
        .set({ status: 'ACTIVE' })
        .where(eq(salespeople.id, seller.id));
      nextStatus = 'ACTIVE';
    }

    const [device] = await db
      .insert(devices)
      .values({
        masterId: seller.masterId,
        userType: 'SELLER',
        userId: seller.id,
        deviceFingerprint: parsed.data.deviceFingerprint,
        platform: parsed.data.platform ?? 'unknown',
      })
      .onConflictDoUpdate({
        target: [devices.userType, devices.userId, devices.deviceFingerprint],
        set: { lastSeenAt: new Date() },
      })
      .returning();

    if (device.blockedAt) {
      return reply.code(403).send({ error: 'DEVICE_BLOCKED' });
    }

    const refreshToken = generateRandomToken(32);
    const [session] = await db
      .insert(sessions)
      .values({
        masterId: seller.masterId,
        salespersonId: seller.id,
        deviceId: device.id,
        refreshTokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    const accessToken = await signSellerAccessToken(
      {
        sub: seller.id,
        masterId: seller.masterId,
        deviceId: device.id,
        sessionId: session.id,
        role: 'SELLER',
      },
      config.SELLER_JWT_SECRET
    );

    await writeAuditEvent(db, {
      masterId: seller.masterId,
      actorType: 'SELLER',
      actorId: seller.id,
      actorRole: 'SELLER',
      deviceId: device.id,
      entityType: 'session',
      entityId: session.id,
      action: 'SELLER_OTP_LOGIN',
      outcome: 'SUCCESS',
    });

    return reply.send({
      accessToken,
      refreshToken,
      deviceId: device.id,
      seller: {
        id: seller.id,
        masterId: seller.masterId,
        phoneE164: seller.phoneE164,
        fullName: seller.fullName,
        status: nextStatus,
      },
    });
  });

  // POST /auth/seller/passphrase/login
  app.post('/auth/seller/passphrase/login', async (request, reply) => {
    const parsed = z
      .object({
        phoneE164: z.string().min(9),
        passphrase: z.string().min(1),
        deviceFingerprint: z.string().min(3),
        platform: z.string().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    let phoneE164: string;
    try {
      phoneE164 = normalizeKenyaPhoneToE164(parsed.data.phoneE164);
    } catch {
      return reply.code(400).send({ error: 'INVALID_KENYA_PHONE' });
    }

    const [seller] = await db
      .select()
      .from(salespeople)
      .where(eq(salespeople.phoneE164, phoneE164))
      .limit(1);

    if (!seller || !seller.passphraseHash) {
      await recordFailedPassphraseAttempt(db, { phoneE164 });
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    if (seller.status !== 'ACTIVE') {
      return reply.code(403).send({ error: 'SELLER_INACTIVE' });
    }

    if (await isStoreLockedDown(db, seller.masterId)) {
      return reply.code(403).send({ error: 'STORE_LOCKED_DOWN' });
    }

    const activeAssignments = await db
      .select({ id: stockAssignments.id })
      .from(stockAssignments)
      .where(
        and(eq(stockAssignments.salespersonId, seller.id), eq(stockAssignments.status, 'ACTIVE'))
      )
      .limit(1);
    if (activeAssignments.length === 0) {
      return reply.code(403).send({ error: 'NO_ACTIVE_ASSIGNMENT' });
    }

    const valid = await verifyPassphrase(seller.passphraseHash, parsed.data.passphrase);
    if (!valid) {
      const result = await recordFailedPassphraseAttempt(db, {
        masterId: seller.masterId,
        salespersonId: seller.id,
        phoneE164,
        notifier,
      });
      return reply.code(401).send({
        error: result.lockedOut ? 'ACCOUNT_LOCKED_BURST' : 'INVALID_CREDENTIALS',
      });
    }

    const [device] = await db
      .insert(devices)
      .values({
        masterId: seller.masterId,
        userType: 'SELLER',
        userId: seller.id,
        deviceFingerprint: parsed.data.deviceFingerprint,
        platform: parsed.data.platform ?? 'unknown',
      })
      .onConflictDoUpdate({
        target: [devices.userType, devices.userId, devices.deviceFingerprint],
        set: { lastSeenAt: new Date() },
      })
      .returning();

    if (device.blockedAt) {
      return reply.code(403).send({ error: 'DEVICE_BLOCKED' });
    }

    const refreshToken = generateRandomToken(32);
    const [session] = await db
      .insert(sessions)
      .values({
        masterId: seller.masterId,
        salespersonId: seller.id,
        deviceId: device.id,
        refreshTokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    const accessToken = await signSellerAccessToken(
      {
        sub: seller.id,
        masterId: seller.masterId,
        deviceId: device.id,
        sessionId: session.id,
        role: 'SELLER',
      },
      config.SELLER_JWT_SECRET
    );

    await writeAuditEvent(db, {
      masterId: seller.masterId,
      actorType: 'SELLER',
      actorId: seller.id,
      actorRole: 'SELLER',
      deviceId: device.id,
      entityType: 'session',
      entityId: session.id,
      action: 'SELLER_LOGIN_PASSPHRASE',
      outcome: 'SUCCESS',
      afterState: { phoneE164: seller.phoneE164, sellerName: seller.fullName },
    });

    return reply.send({
      accessToken,
      refreshToken,
      deviceId: device.id,
      seller: {
        id: seller.id,
        masterId: seller.masterId,
        phoneE164: seller.phoneE164,
        fullName: seller.fullName,
        status: seller.status,
      },
    });
  });

  // POST /auth/seller/refresh - rotating refresh tokens with reuse detection
  app.post('/auth/seller/refresh', async (request, reply) => {
    const parsed = z
      .object({
        refreshToken: z.string().min(10),
        deviceFingerprint: z.string().min(3),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const hash = sha256Hex(parsed.data.refreshToken);
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, hash))
      .limit(1);

    if (!session) {
      return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN' });
    }

    if (session.revokedAt !== null) {
      await handleRefreshTokenReuse(db, {
        masterId: session.masterId,
        salespersonId: session.salespersonId,
        deviceId: session.deviceId,
        sessionId: session.id,
        notifier,
      });
      return reply.code(401).send({ error: 'REFRESH_TOKEN_REUSED' });
    }

    if (session.expiresAt < new Date()) {
      return reply.code(401).send({ error: 'REFRESH_TOKEN_EXPIRED' });
    }

    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, session.deviceId))
      .limit(1);
    if (!device || device.blockedAt !== null || device.deviceFingerprint !== parsed.data.deviceFingerprint) {
      return reply.code(403).send({ error: 'DEVICE_MISMATCH_OR_BLOCKED' });
    }

    const [seller] = await db
      .select()
      .from(salespeople)
      .where(eq(salespeople.id, session.salespersonId))
      .limit(1);
    if (!seller || seller.status !== 'ACTIVE') {
      return reply.code(403).send({ error: 'SELLER_INACTIVE' });
    }

    if (await isStoreLockedDown(db, seller.masterId)) {
      return reply.code(403).send({ error: 'STORE_LOCKED_DOWN' });
    }

    const activeAssignments = await db
      .select({ id: stockAssignments.id })
      .from(stockAssignments)
      .where(
        and(eq(stockAssignments.salespersonId, seller.id), eq(stockAssignments.status, 'ACTIVE'))
      )
      .limit(1);
    if (activeAssignments.length === 0) {
      return reply.code(403).send({ error: 'NO_ACTIVE_ASSIGNMENT' });
    }

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.id, session.id));

    const newRefreshToken = generateRandomToken(32);
    const [newSession] = await db
      .insert(sessions)
      .values({
        masterId: session.masterId,
        salespersonId: session.salespersonId,
        deviceId: session.deviceId,
        refreshTokenHash: sha256Hex(newRefreshToken),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })
      .returning();

    const accessToken = await signSellerAccessToken(
      {
        sub: seller.id,
        masterId: seller.masterId,
        deviceId: device.id,
        sessionId: newSession.id,
        role: 'SELLER',
      },
      config.SELLER_JWT_SECRET
    );

    return reply.send({ accessToken, refreshToken: newRefreshToken });
  });

  // POST /auth/logout
  app.post('/auth/logout', { preHandler: authenticate }, async (request, reply) => {
    if (request.auth?.sessionId) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, request.auth.sessionId));
    }
    return reply.send({ ok: true });
  });

  // GET /me
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const auth = request.auth!;
    const [master] = await db
      .select()
      .from(masters)
      .where(eq(masters.id, auth.masterId))
      .limit(1);

    if (auth.role === 'MERCHANT') {
      return reply.send({
        role: 'MERCHANT',
        master,
        storeConfig: {
          allowByWeightSellers: master?.allowByWeightSellers ?? true,
          roundingRule: master?.roundingRule ?? 'ROUND_TO_SHILLING',
          creditTermsDays: master?.creditTermsDays ?? 4,
          policyAcceptedAt: master?.policyAcceptedAt ?? null,
        },
      });
    }

    const [seller] = await db
      .select({
        id: salespeople.id,
        masterId: salespeople.masterId,
        phoneE164: salespeople.phoneE164,
        fullName: salespeople.fullName,
        status: salespeople.status,
        creditCapNominalGrams: salespeople.creditCapNominalGrams,
      })
      .from(salespeople)
      .where(eq(salespeople.id, auth.userId))
      .limit(1);

    const activeAssignments = await db
      .select()
      .from(stockAssignments)
      .where(
        and(eq(stockAssignments.salespersonId, auth.userId), eq(stockAssignments.status, 'ACTIVE'))
      );

    return reply.send({
      role: 'SELLER',
      seller,
      activeAssignments,
      storeConfig: {
        allowByWeightSellers: master?.allowByWeightSellers ?? true,
        roundingRule: master?.roundingRule ?? 'ROUND_TO_SHILLING',
        creditTermsDays: master?.creditTermsDays ?? 4,
      },
    });
  });

  // PATCH /me/config (Master only)
  app.patch('/me/config', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const parsed = z
      .object({
        allowByWeightSellers: z.boolean().optional(),
        roundingRule: z.enum(['ROUND_TO_SHILLING', 'ROUND_HALF_UP_CENTS']).optional(),
        creditTermsDays: z.number().int().min(1).max(30).optional(),
        storeName: z.string().min(1).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const [updated] = await db
      .update(masters)
      .set(parsed.data)
      .where(eq(masters.id, request.auth!.masterId))
      .returning();

    return reply.send({ master: updated });
  });

  // POST /me/terms-acceptance
  app.post('/me/terms-acceptance', { preHandler: authenticate }, async (request, reply) => {
    const parsed = z
      .object({ termsVersion: z.string().min(1).default('v1') })
      .safeParse(request.body ?? {});
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    if (auth.role === 'MERCHANT') {
      const [updated] = await db
        .update(masters)
        .set({ policyAcceptedAt: new Date() })
        .where(eq(masters.id, auth.masterId))
        .returning();
      return reply.send({ ok: true, policyAcceptedAt: updated.policyAcceptedAt });
    }

    const [row] = await db
      .insert(termsAcceptances)
      .values({
        masterId: auth.masterId,
        salespersonId: auth.userId,
        termsVersion: parsed.data.termsVersion,
        deviceId: auth.deviceId ?? null,
      })
      .returning();
    return reply.send({ ok: true, acceptance: row });
  });

  // POST /push-tokens
  app.post('/push-tokens', { preHandler: authenticate }, async (request, reply) => {
    const parsed = z
      .object({ expoPushToken: z.string().min(10) })
      .safeParse(request.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const auth = request.auth!;
    const [row] = await db
      .insert(pushTokens)
      .values({
        masterId: auth.masterId,
        userType: auth.actorType,
        userId: auth.userId,
        deviceId: auth.deviceId ?? null,
        expoPushToken: parsed.data.expoPushToken,
      })
      .onConflictDoUpdate({
        target: pushTokens.expoPushToken,
        set: {
          userId: auth.userId,
          deviceId: auth.deviceId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return reply.send({ pushToken: row });
  });

  // Security & Lockdown endpoints (Master only)
  app.get('/security/events', { preHandler: [authenticate, requireMaster] }, async (request, reply) => {
    const events = await db
      .select()
      .from(securityEvents)
      .where(eq(securityEvents.masterId, request.auth!.masterId))
      .orderBy(desc(securityEvents.createdAt))
      .limit(100);
    return reply.send({ events });
  });

  app.post(
    '/security/revoke-all-sessions',
    { preHandler: [authenticate, requireMaster, requireStepUpMfa] },
    async (request, reply) => {
      const auth = request.auth!;
      const now = new Date();
      await db
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.masterId, auth.masterId), isNull(sessions.revokedAt)));

      await recordSecurityEvent(db, {
        masterId: auth.masterId,
        eventType: 'MASTER_REVOKED_ALL_SESSIONS',
        severity: 'TIER_3',
        actorType: 'MASTER',
        actorId: auth.userId,
      });

      return reply.send({ ok: true, revokedAt: now });
    }
  );

  app.post(
    '/security/lockdown',
    { preHandler: [authenticate, requireMaster, requireStepUpMfa] },
    async (request, reply) => {
      const parsed = z.object({ reason: z.string().min(3) }).safeParse(request.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const auth = request.auth!;
      const now = new Date();
      await db
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.masterId, auth.masterId), isNull(sessions.revokedAt)));

      const [lockdown] = await db
        .insert(securityLockdowns)
        .values({
          masterId: auth.masterId,
          reason: parsed.data.reason,
          isActive: true,
          triggeredBy: auth.userId,
        })
        .returning();

      await recordSecurityEvent(db, {
        masterId: auth.masterId,
        eventType: 'STORE_LOCKDOWN_ACTIVATED',
        severity: 'TIER_3',
        actorType: 'MASTER',
        actorId: auth.userId,
        details: { reason: parsed.data.reason },
      });

      return reply.code(201).send({ lockdown });
    }
  );

  app.post(
    '/security/unlockdown',
    { preHandler: [authenticate, requireMaster, requireStepUpMfa] },
    async (request, reply) => {
      const auth = request.auth!;
      const now = new Date();
      await db
        .update(securityLockdowns)
        .set({ isActive: false, unlockedBy: auth.userId, unlockedAt: now })
        .where(and(eq(securityLockdowns.masterId, auth.masterId), eq(securityLockdowns.isActive, true)));

      await recordSecurityEvent(db, {
        masterId: auth.masterId,
        eventType: 'STORE_LOCKDOWN_CLEARED',
        severity: 'TIER_1',
        actorType: 'MASTER',
        actorId: auth.userId,
      });

      return reply.send({ ok: true, unlockedAt: now });
    }
  );

  app.post(
    '/security/devices/:id/block',
    { preHandler: [authenticate, requireMaster, requireStepUpMfa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;
      const now = new Date();
      const [updated] = await db
        .update(devices)
        .set({ blockedAt: now })
        .where(and(eq(devices.id, id), eq(devices.masterId, auth.masterId)))
        .returning();
      if (!updated) return reply.code(404).send({ error: 'DEVICE_NOT_FOUND' });

      await db
        .update(sessions)
        .set({ revokedAt: now })
        .where(and(eq(sessions.deviceId, id), isNull(sessions.revokedAt)));

      return reply.send({ device: updated });
    }
  );

  app.post(
    '/security/devices/:id/unblock',
    { preHandler: [authenticate, requireMaster, requireStepUpMfa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const auth = request.auth!;
      const [updated] = await db
        .update(devices)
        .set({ blockedAt: null })
        .where(and(eq(devices.id, id), eq(devices.masterId, auth.masterId)))
        .returning();
      if (!updated) return reply.code(404).send({ error: 'DEVICE_NOT_FOUND' });

      return reply.send({ device: updated });
    }
  );
}
