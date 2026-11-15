import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { AppConfig } from '../config.js';
import { AppDb } from '../db/pool.js';
import * as schema from '../db/schema.js';
import {
  priceApprovals,
  smsOutbox,
} from '../db/schema.js';
import { ClerkTokenVerifier } from '../auth/tokens.js';
import { ConsoleSmsProvider } from '../providers/sms.js';
import {
  runExpirePendingApprovalsJob,
  runMarketCloseJob,
  runMidnightRollover,
} from '../jobs/scheduler.js';
import { addDaysToDateStr, getNairobiBusinessDate } from '../utils/time.js';
import { computeExpectedNetWeightGrams, computeNccPayableCents } from '../utils/money.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function makeMasterToken(clerkUserId: string, ageSec = 10): string {
  const iat = Math.floor(Date.now() / 1000) - ageSec;
  return `test-clerk:${clerkUserId}:${iat}`;
}

const testClerkVerifier: ClerkTokenVerifier = async (token: string) => {
  if (!token.startsWith('test-clerk:')) {
    throw new Error('Invalid test clerk token');
  }
  const [, clerkUserId, iatStr] = token.split(':');
  const iat = Number(iatStr);
  return {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
    authTimeEpochSec: iat,
    issuedAtEpochSec: iat,
  };
};

describe('Phase 2A Backend Acceptance Tests (18/18)', () => {
  let pglite: PGlite;
  let db: AppDb;
  let app: FastifyInstance;
  let smsProvider: ConsoleSmsProvider;

  const masterClerkId = 'clerk_master_01';
  let masterToken: string;
  let masterId: string;
  let batchId: string;
  let assignmentId: string;
  let sellerId: string;
  let sellerAccessToken: string;
  let sellerRefreshToken: string;
  const sellerPhone = '+254712345678';
  const sellerDeviceFp = 'android-fp-001';
  const sellerPassphrase = 'OnionPassphrase2026!';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    pglite = new PGlite();
    await pglite.waitReady;

    const sqlPath = path.join(__dirname, '..', 'db', 'migrations', '0001_init.sql');
    const sqlText = await fs.readFile(sqlPath, 'utf8');
    await pglite.exec(sqlText);
    await pglite.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user LOGIN PASSWORD 'app_pass';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO app_user;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
      REVOKE UPDATE, DELETE ON audit_events FROM app_user;
      REVOKE UPDATE, DELETE ON stock_movements FROM app_user;
      REVOKE UPDATE, DELETE ON variance_explanations FROM app_user;
    `);

    db = drizzle(pglite, { schema }) as unknown as AppDb;

    const config: AppConfig = {
      NODE_ENV: 'test',
      PORT: 3001,
      HOST: '127.0.0.1',
      DATABASE_URL: 'postgres://local-pglite/test',
      SELLER_JWT_SECRET: 'test-seller-jwt-secret-must-be-at-least-32-chars',
      SMS_PROVIDER: 'console',
      AFRICASTALKING_SENDER_ID: 'THEGEM',
    };

    smsProvider = new ConsoleSmsProvider();
    const built = await buildApp({
      db,
      config,
      clerkVerifier: testClerkVerifier,
      smsProvider,
    });
    app = built.app;
    await app.ready();
    masterToken = makeMasterToken(masterClerkId, 5);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (pglite) await pglite.close();
  });

  it('1. Master sync (/auth/master/sync) creates Master and seeds defaults', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/master/sync',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: {
        email: 'master@thegem.co.ke',
        fullName: 'Wanjiku Master',
        storeName: 'Wakulima Onions',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.master.clerkUserId).toBe(masterClerkId);
    masterId = body.master.id;

    const meRes = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().role).toBe('MERCHANT');
  });

  it('4. Batch creation computes NCC tariffs (500->8000, 400->6000, 350->6000, 250->6000) & flags mismatch', async () => {
    expect(computeNccPayableCents(500)).toBe(800000);
    expect(computeNccPayableCents(400)).toBe(600000);
    expect(computeNccPayableCents(350)).toBe(600000);
    expect(computeNccPayableCents(250)).toBe(600000);

    // 500 nets loaded = 10,000,000 g nominal; NCC counted 500 -> 800,000 cents, official 750,000 -> mismatch
    const res = await app.inject({
      method: 'POST',
      url: '/batches',
      headers: {
        authorization: `Bearer ${masterToken}`,
        'idempotency-key': 'batch-create-1',
      },
      payload: {
        batchNumber: 'BATCH-001',
        truckPlate: 'KDA 123A',
        packagingGrams: 20000,
        netsLoaded: 500,
        initialGrade1NominalGrams: 6000000, // 300 nets
        initialGrade2NominalGrams: 4000000, // 200 nets
        nccCountedNets: 500,
        nccReceiptNo: 'NCC-991',
        nccOfficialAmountCents: 750000,
        isNccCessPaid: true,
        priceG1Cents: 200000, // KSh 2,000 / net
        minPriceG1Cents: 180000, // KSh 1,800 / net
        priceG2Cents: 150000,
        minPriceG2Cents: 130000,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    batchId = body.batch.id;
    expect(body.batch.nccComputedPayableCents).toBe(800000);
    expect(body.batch.nccAmountMismatch).toBe(true);

    const expRes = await app.inject({
      method: 'GET',
      url: `/batches/${batchId}/expenses`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(expRes.statusCode).toBe(200);
    expect(expRes.json().expenses.length).toBe(1);
    expect(expRes.json().expenses[0].amountCents).toBe(750000);
  });

  it('5. Allocation & topup double-entry preserves pool invariant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assignments',
      headers: {
        authorization: `Bearer ${masterToken}`,
        'idempotency-key': 'assign-1',
      },
      payload: {
        phoneE164: '0712345678',
        fullName: 'Kamau Seller',
        batchId,
        grade1NominalGrams: 1000000, // 50 nets
        grade2NominalGrams: 400000, // 20 nets
        creditCapNominalGrams: 100000, // 5 nets cap
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    assignmentId = body.assignment.id;
    sellerId = body.seller.id;

    // Topup 10 nets G1 (200,000 g)
    const topupRes = await app.inject({
      method: 'POST',
      url: `/assignments/${assignmentId}/topup`,
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { grade1NominalGrams: 200000, grade2NominalGrams: 0 },
    });
    expect(topupRes.statusCode).toBe(200);

    const activeRes = await app.inject({
      method: 'GET',
      url: '/batches/active',
      headers: { authorization: `Bearer ${masterToken}` },
    });
    const b = activeRes.json().batches.find((x: { id: string }) => x.id === batchId);
    // 6,000,000 - 1,000,000 - 200,000 = 4,800,000 g
    expect(b.poolGrade1NominalGrams).toBe(4800000);
    // 4,000,000 - 400,000 = 3,600,000 g
    expect(b.poolGrade2NominalGrams).toBe(3600000);
  });

  it('2. Seller OTP -> Passphrase setup -> Login -> Rotating refresh + reuse detection', async () => {
    const otpReq = await app.inject({
      method: 'POST',
      url: '/auth/seller/otp/request',
      payload: { phoneE164: sellerPhone, purpose: 'INVITE' },
    });
    expect(otpReq.statusCode).toBe(200);
    const lastSms = smsProvider.sentMessages[smsProvider.sentMessages.length - 1];
    const codeMatch = lastSms.body.match(/(\d{6})/);
    expect(codeMatch).not.toBeNull();
    const otpCode = codeMatch![1];

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/seller/otp/verify',
      payload: {
        phoneE164: sellerPhone,
        code: otpCode,
        purpose: 'INVITE',
        deviceFingerprint: sellerDeviceFp,
        platform: 'android',
        passphrase: sellerPassphrase,
      },
    });
    expect(verifyRes.statusCode).toBe(200);
    const firstRefresh = verifyRes.json().refreshToken;

    // Login with passphrase
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/seller/passphrase/login',
      payload: {
        phoneE164: sellerPhone,
        passphrase: sellerPassphrase,
        deviceFingerprint: sellerDeviceFp,
      },
    });
    expect(loginRes.statusCode).toBe(200);
    sellerAccessToken = loginRes.json().accessToken;
    sellerRefreshToken = loginRes.json().refreshToken;

    // Rotate firstRefresh -> ok
    const rot1 = await app.inject({
      method: 'POST',
      url: '/auth/seller/refresh',
      payload: { refreshToken: firstRefresh, deviceFingerprint: sellerDeviceFp },
    });
    expect(rot1.statusCode).toBe(200);

    // Reuse firstRefresh -> triggers REFRESH_TOKEN_REUSE_DETECTED, revokes all sessions & blocks device
    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/seller/refresh',
      payload: { refreshToken: firstRefresh, deviceFingerprint: sellerDeviceFp },
    });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().error).toBe('REFRESH_TOKEN_REUSED');

    // Old sellerAccessToken should now fail on /me because sessions were revoked & device blocked
    const meBlocked = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
    });
    expect([401, 403]).toContain(meBlocked.statusCode);

    // Unblock device (Master step-up MFA) & re-login cleanly for subsequent tests
    const devRows = await db.execute(
      sql`SELECT id FROM devices WHERE user_id = ${sellerId} LIMIT 1`
    );
    const devId = (devRows.rows[0] as { id: string }).id;
    const unblockRes = await app.inject({
      method: 'POST',
      url: `/security/devices/${devId}/unblock`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(unblockRes.statusCode).toBe(200);

    const login2 = await app.inject({
      method: 'POST',
      url: '/auth/seller/passphrase/login',
      payload: {
        phoneE164: sellerPhone,
        passphrase: sellerPassphrase,
        deviceFingerprint: sellerDeviceFp,
      },
    });
    expect(login2.statusCode).toBe(200);
    sellerAccessToken = login2.json().accessToken;
    sellerRefreshToken = login2.json().refreshToken;
  });

  it('6. Fractional half-net (10,000 g) PER_NET & BY_WEIGHT + allowByWeightSellers toggle', async () => {
    // Half-net PER_NET (10,000 g @ 200,000 cents/net -> 100,000 cents)
    const sale1 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 10000,
        weighedGrams: 9800,
        unitPricePerNetCents: 200000,
        paymentMode: 'CASH',
      },
    });
    expect(sale1.statusCode).toBe(201);
    expect(sale1.json().sale.billedGrams).toBe(10000);
    expect(sale1.json().sale.totalAmountCents).toBe(100000);

    // BY_WEIGHT (20,000 g nominal, 19,000 g weighed @ 200,000 -> 190,000 cents)
    const sale2 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'BY_WEIGHT',
        quantityNominalGrams: 20000,
        weighedGrams: 19000,
        unitPricePerNetCents: 200000,
        paymentMode: 'MPESA',
        mpesaReceipt: 'MPESA001XY',
        payerPhoneE164: '+254712000111',
      },
    });
    expect(sale2.statusCode).toBe(201);
    expect(sale2.json().sale.billedGrams).toBe(19000);
    expect(sale2.json().sale.totalAmountCents).toBe(190000);

    // Master disables BY_WEIGHT for sellers
    await app.inject({
      method: 'PATCH',
      url: '/me/config',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { allowByWeightSellers: false },
    });

    const blockedByWeight = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'BY_WEIGHT',
        quantityNominalGrams: 20000,
        weighedGrams: 19000,
        unitPricePerNetCents: 200000,
        paymentMode: 'CASH',
      },
    });
    expect(blockedByWeight.statusCode).toBe(403);
    expect(blockedByWeight.json().error).toBe('BY_WEIGHT_DISABLED_FOR_SELLERS');

    // Re-enable
    await app.inject({
      method: 'PATCH',
      url: '/me/config',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { allowByWeightSellers: true },
    });
  });

  it('7. Below-floor sale reserves stock (PENDING_PRICE_APPROVAL) and approve/reject releases/confirms', async () => {
    const lowSale = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 160000, // below floor 180,000
        paymentMode: 'CASH',
      },
    });
    expect(lowSale.statusCode).toBe(201);
    expect(lowSale.json().sale.status).toBe('PENDING_APPROVAL');
    const paId = lowSale.json().priceApproval.id;

    const appRes = await app.inject({
      method: 'POST',
      url: `/price-approvals/${paId}/approve`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(appRes.statusCode).toBe(200);
    expect(appRes.json().sale.status).toBe('CONFIRMED');

    // Reject path
    const lowSale2 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 150000,
        paymentMode: 'CASH',
      },
    });
    const pa2Id = lowSale2.json().priceApproval.id;
    const rejRes = await app.inject({
      method: 'POST',
      url: `/price-approvals/${pa2Id}/reject`,
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { reason: 'Too low' },
    });
    expect(rejRes.statusCode).toBe(200);
    expect(rejRes.json().sale.status).toBe('REJECTED');
  });

  it('8. Credit sale requires buyer ID/phone, guarantor acceptance within cap, else Master approval + SMS', async () => {
    // Missing buyer -> 400
    const noBuyer = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_2',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 150000,
        paymentMode: 'CREDIT',
      },
    });
    expect(noBuyer.statusCode).toBe(400);

    // Within cap (100,000 g) with guarantorAccepted=true -> GUARANTOR_ACCEPTED + sms_outbox queued
    const cr1 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_2',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 40000,
        weighedGrams: 40000,
        unitPricePerNetCents: 150000,
        paymentMode: 'CREDIT',
        guarantorAccepted: true,
        guarantorTermsVersion: 'v1',
        buyer: {
          fullName: 'Mama Mboga',
          phoneE164: '+254722111222',
          nationalId: '28123456',
        },
      },
    });
    expect(cr1.statusCode).toBe(201);
    expect(cr1.json().creditEntry.approvalStatus).toBe('APPROVED');
    expect(cr1.json().sale.status).toBe('CONFIRMED');

    const queuedSms = await db
      .select()
      .from(smsOutbox)
      .where(eq(smsOutbox.toPhoneE164, '+254722111222'));
    expect(queuedSms.length).toBeGreaterThanOrEqual(1);

    // Exceeds cap (40,000 + 80,000 = 120,000 > 100,000) -> PENDING_CREDIT_APPROVAL
    const cr2 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_2',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 80000,
        weighedGrams: 80000,
        unitPricePerNetCents: 150000,
        paymentMode: 'CREDIT',
        guarantorAccepted: true,
        buyer: {
          fullName: 'Mama Mboga',
          phoneE164: '+254722111222',
          nationalId: '28123456',
        },
      },
    });
    expect(cr2.statusCode).toBe(201);
    expect(cr2.json().sale.status).toBe('PENDING_APPROVAL');
    const ce2Id = cr2.json().creditEntry.id;

    const appCr = await app.inject({
      method: 'POST',
      url: `/credit-entries/${ce2Id}/approve`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(appCr.statusCode).toBe(200);
    expect(appCr.json().sale.status).toBe('CONFIRMED');
  });

  it('10. Idempotency-Key replay returns cached response; different payload returns 409', async () => {
    const payload = {
      batchId,
      assignmentId,
      grade: 'GRADE_1',
      pricingMode: 'PER_NET',
      quantityNominalGrams: 20000,
      weighedGrams: 20000,
      unitPricePerNetCents: 200000,
      paymentMode: 'CASH',
    };
    const r1 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: {
        authorization: `Bearer ${sellerAccessToken}`,
        'idempotency-key': 'idem-sale-10',
      },
      payload,
    });
    expect(r1.statusCode).toBe(201);

    const r2 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: {
        authorization: `Bearer ${sellerAccessToken}`,
        'idempotency-key': 'idem-sale-10',
      },
      payload,
    });
    expect(r2.statusCode).toBe(201);
    expect(r2.json().sale.id).toBe(r1.json().sale.id);

    const r3 = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: {
        authorization: `Bearer ${sellerAccessToken}`,
        'idempotency-key': 'idem-sale-10',
      },
      payload: { ...payload, quantityNominalGrams: 40000 },
    });
    expect(r3.statusCode).toBe(409);
  });

  it('11. Seller cannot read Master ledger summary or other sellers sales', async () => {
    const ledgerRes = await app.inject({
      method: 'GET',
      url: `/batches/${batchId}/ledger-summary`,
      headers: { authorization: `Bearer ${sellerAccessToken}` },
    });
    expect(ledgerRes.statusCode).toBe(403);

    // Master records a direct pool sale
    await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: {
        batchId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 200000,
        paymentMode: 'CASH',
      },
    });

    const sellerSales = await app.inject({
      method: 'GET',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
    });
    expect(sellerSales.statusCode).toBe(200);
    const list = sellerSales.json().sales as Array<{ sellerId: string }>;
    expect(list.every((s) => s.sellerId === sellerId)).toBe(true);
  });

  it('12. Shrinkage derived on read; rollover never writes SHRINKAGE movements; weigh_samples flag never opens variance case', async () => {
    expect(computeExpectedNetWeightGrams(20000, 0)).toBe(20000);
    expect(computeExpectedNetWeightGrams(20000, 3)).toBe(19400);
    expect(computeExpectedNetWeightGrams(20000, 12)).toBe(18000); // floor at day 10

    // Weigh sample well below expected (15000 < 20000 - tolerance)
    const wsRes = await app.inject({
      method: 'POST',
      url: `/batches/${batchId}/weigh-samples`,
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: { sampleWeightG: 15000 },
    });
    expect(wsRes.statusCode).toBe(201);

    // Submit reconciliation with EXACT nominal count (no nominal shortfall)
    const activeRes = await app.inject({
      method: 'GET',
      url: '/assignments',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
    });
    const myAssign = activeRes.json().assignments[0];

    const recRes = await app.inject({
      method: 'POST',
      url: '/reconciliations',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        physicalG1NominalGrams: myAssign.availableGrade1NominalGrams,
        physicalG2NominalGrams: myAssign.availableGrade2NominalGrams,
      },
    });
    expect(recRes.statusCode).toBe(201);
    expect(recRes.json().reconciliation.weightCheckFlagged).toBe(true);
    expect(recRes.json().varianceCase).toBeNull();
  });

  it('15. Day 2+ rollover posts flat 100,000 cents/day + recurring expenses, never SHRINKAGE, and /depart stops them', async () => {
    const tomorrow = addDaysToDateStr(getNairobiBusinessDate(), 1);
    await runMidnightRollover(db, tomorrow);

    // Verify ZERO SHRINKAGE movements
    const shrinkMoves = await db.execute(
      sql`SELECT count(*)::int AS c FROM stock_movements WHERE movement_type = 'SHRINKAGE'`
    );
    expect((shrinkMoves.rows[0] as { c: number }).c).toBe(0);

    // Check Day 2 expenses created (NCC_CESS 100000 + WATCHMAN 10000 + CLEANERS_SWEEPERS 10000)
    const expDay2 = await app.inject({
      method: 'GET',
      url: `/batches/${batchId}/expenses`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    const day2List = (expDay2.json().expenses as Array<{ description: string; amountCents: number }>).filter(
      (e) => e.description.startsWith('Day 2')
    );
    expect(day2List.length).toBe(3);

    // Truck departs -> Day 3 rollover should post 0 Day 3 expenses
    const depRes = await app.inject({
      method: 'POST',
      url: `/batches/${batchId}/depart`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(depRes.statusCode).toBe(200);

    const day3 = addDaysToDateStr(tomorrow, 1);
    await runMidnightRollover(db, day3);

    const expDay3 = await app.inject({
      method: 'GET',
      url: `/batches/${batchId}/expenses`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    const day3List = (expDay3.json().expenses as Array<{ description: string }>).filter((e) =>
      e.description.startsWith('Day 3')
    );
    expect(day3List.length).toBe(0);
  });

  it('14. 14:00 EAT market close blocks regular sales; late-session & offline sync work', async () => {
    await runMarketCloseJob(db, getNairobiBusinessDate());

    const blocked = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 200000,
        paymentMode: 'CASH',
      },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe('MARKET_CLOSED');

    // Offline synced sale allowed with pendingReview=true
    const offlineSale = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 200000,
        paymentMode: 'CASH',
        isOfflineSynced: true,
      },
    });
    expect(offlineSale.statusCode).toBe(201);
    expect(offlineSale.json().sale.pendingReview).toBe(true);

    // Master opens late session -> regular sale allowed with isLateSale=true
    await app.inject({
      method: 'POST',
      url: '/market-sessions/late-session/open',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { lateReason: 'Late buyer truck', durationMinutes: 60 },
    });
    const lateSale = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 200000,
        paymentMode: 'CASH',
      },
    });
    expect(lateSale.statusCode).toBe(201);
    expect(lateSale.json().sale.isLateSale).toBe(true);
  });

  it('16. Pending price approval expiry job releases reserved stock', async () => {
    const lowSale = await app.inject({
      method: 'POST',
      url: '/sales',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: {
        batchId,
        assignmentId,
        grade: 'GRADE_1',
        pricingMode: 'PER_NET',
        quantityNominalGrams: 20000,
        weighedGrams: 20000,
        unitPricePerNetCents: 140000,
        paymentMode: 'CASH',
      },
    });
    const paId = lowSale.json().priceApproval.id;

    // Force expiresAt into the past
    await db
      .update(priceApprovals)
      .set({ expiresAt: new Date(Date.now() - 60000) })
      .where(eq(priceApprovals.id, paId));

    await runExpirePendingApprovalsJob(db);

    const [paRow] = await db.select().from(priceApprovals).where(eq(priceApprovals.id, paId));
    expect(paRow.status).toBe('EXPIRED');
  });

  it('13 & 3. Shortfall on assignment close opens variance case, blocks close; decision writes WRITE_OFF & liability; closing revokes seller access', async () => {
    const activeRes = await app.inject({
      method: 'GET',
      url: '/assignments',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
    });
    const myAssign = activeRes.json().assignments[0];

    // Try closing with 1 net (20,000 g) missing on Grade 1
    const closeFail = await app.inject({
      method: 'POST',
      url: `/assignments/${assignmentId}/close`,
      headers: { authorization: `Bearer ${masterToken}` },
      payload: {
        physicalG1NominalGrams: myAssign.availableGrade1NominalGrams - 20000,
        physicalG2NominalGrams: myAssign.availableGrade2NominalGrams,
      },
    });
    expect(closeFail.statusCode).toBe(409);
    const vcId = closeFail.json().varianceCase.id;

    // Seller submits append-only explanation
    const expRes = await app.inject({
      method: 'POST',
      url: `/variance-cases/${vcId}/explanations`,
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: { reasonCode: 'SPOILAGE', explanationText: '1 net rotted in rain' },
    });
    expect(expRes.statusCode).toBe(201);
    expect(expRes.json().explanation.version).toBe(1);

    // Master decides CHARGE -> WRITE_OFF movement + liability entry
    const decRes = await app.inject({
      method: 'POST',
      url: `/variance-cases/${vcId}/decide`,
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { decision: 'CHARGE', chargeAmountCents: 100000, notes: 'Half charge' },
    });
    expect(decRes.statusCode).toBe(200);
    expect(decRes.json().liability.amountCents).toBe(100000);

    // Seller disputes liability
    const dispRes = await app.inject({
      method: 'POST',
      url: `/liability-entries/${decRes.json().liability.id}/dispute`,
      headers: { authorization: `Bearer ${sellerAccessToken}` },
      payload: { disputeNote: 'Rain damaged net before delivery' },
    });
    expect(dispRes.statusCode).toBe(200);
    expect(dispRes.json().liabilityEntry.isDisputed).toBe(true);

    // Now close assignment cleanly with actual physical count (which matches book after WRITE_OFF)
    const closeOk = await app.inject({
      method: 'POST',
      url: `/assignments/${assignmentId}/close`,
      headers: { authorization: `Bearer ${masterToken}` },
      payload: {
        physicalG1NominalGrams: myAssign.availableGrade1NominalGrams - 20000,
        physicalG2NominalGrams: myAssign.availableGrade2NominalGrams,
      },
    });
    expect(closeOk.statusCode).toBe(200);
    expect(closeOk.json().assignment.status).toBe('CLOSED');

    // Test 3: Seller access is immediately revoked!
    const afterClose = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${sellerAccessToken}` },
    });
    expect([401, 403]).toContain(afterClose.statusCode);
  });

  it('9. Credit repayments allowed even after batch CLOSED', async () => {
    const closeBatchRes = await app.inject({
      method: 'POST',
      url: `/batches/${batchId}/close`,
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(closeBatchRes.statusCode).toBe(200);

    const crRes = await app.inject({
      method: 'GET',
      url: '/credit-entries',
      headers: { authorization: `Bearer ${masterToken}` },
    });
    const ce = crRes.json().creditEntries[0];

    const repRes = await app.inject({
      method: 'POST',
      url: `/credit-entries/${ce.id}/repayments`,
      headers: {
        authorization: `Bearer ${masterToken}`,
        'idempotency-key': 'repay-closed-batch-1',
      },
      payload: {
        method: 'MPESA',
        amountCents: 100000,
        mpesaReceipt: 'REPAY001AB',
        payerPhoneE164: '+254722111222',
      },
    });
    expect(repRes.statusCode).toBe(201);
    expect(repRes.json().remainingOwedCents).toBe(ce.totalOwedCents - 100000);
  });

  it('17. Security containment: anonymous failures never trigger store lockdown; step-up MFA enforced for lockdown', async () => {
    for (let i = 0; i < 6; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/seller/passphrase/login',
        payload: {
          phoneE164: '+254799999999',
          passphrase: 'wrong',
          deviceFingerprint: 'anon-fp',
        },
      });
    }
    const lockdowns = await db.execute(
      sql`SELECT count(*)::int AS c FROM security_lockdowns WHERE is_active = true`
    );
    expect((lockdowns.rows[0] as { c: number }).c).toBe(0);

    // Stale Master token (age 400s > 300s) rejected on /security/lockdown
    const staleToken = makeMasterToken(masterClerkId, 400);
    const staleRes = await app.inject({
      method: 'POST',
      url: '/security/lockdown',
      headers: { authorization: `Bearer ${staleToken}` },
      payload: { reason: 'Test' },
    });
    expect(staleRes.statusCode).toBe(403);

    // Fresh token succeeds and unlockdown clears
    const lockRes = await app.inject({
      method: 'POST',
      url: '/security/lockdown',
      headers: { authorization: `Bearer ${masterToken}` },
      payload: { reason: 'Drill' },
    });
    expect(lockRes.statusCode).toBe(201);

    const unlockRes = await app.inject({
      method: 'POST',
      url: '/security/unlockdown',
      headers: { authorization: `Bearer ${masterToken}` },
    });
    expect(unlockRes.statusCode).toBe(200);
  });

  it('18. app_user DB role cannot UPDATE or DELETE audit_events, stock_movements, or variance_explanations', async () => {
    await pglite.exec('SET ROLE app_user');
    try {
      await expect(pglite.exec('DELETE FROM audit_events')).rejects.toThrow();
      await expect(
        pglite.exec('UPDATE stock_movements SET delta_nominal_grams = 0')
      ).rejects.toThrow();
      await expect(pglite.exec('DELETE FROM variance_explanations')).rejects.toThrow();
    } finally {
      await pglite.exec('RESET ROLE');
    }
  });
});
