import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import { buildApp } from './app.js';
import { AppConfig } from './config.js';
import { AppDb } from './db/pool.js';
import * as schema from './db/schema.js';
import { createClerkTokenVerifier } from './auth/tokens.js';
import { ConsoleSmsProvider } from './providers/sms.js';
import { seedMasterDefaults } from './routes/auth.js';
import { appendStockMovement } from './services/stockLedger.js';
import { getNairobiBusinessDate } from './utils/time.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seedDemoWorkspaceIfEmpty(db: AppDb) {
  const existing = await db.execute(sql`SELECT count(*)::int AS c FROM masters`);
  const count = Number((existing.rows[0] as { c: number })?.c ?? 0);
  if (count > 0) return;

  const today = getNairobiBusinessDate();
  const [master] = await db
    .insert(schema.masters)
    .values({
      clerkUserId: 'dev_master_01',
      email: 'master@wakulima.local',
      fullName: 'Wanjiku Master',
      storeName: 'Wakulima Onions (The Gem)',
      phoneE164: '+254700000001',
    })
    .returning();

  await seedMasterDefaults(db, master.id);

  const [tariff] = await db
    .select()
    .from(schema.nccTariffs)
    .limit(1);

  const [batch] = await db
    .insert(schema.truckBatches)
    .values({
      masterId: master.id,
      batchNumber: 'WB-DEV-001',
      truckPlate: 'KDA 123A',
      originRegionId: 'TZ-NORTH',
      originRegionName: 'Northern Tanzania',
      originSpecificLocation: 'Singida',
      businessDate: today,
      dayNumber: 1,
      packagingGrams: 20000,
      netsLoaded: 500,
      initialGrade1NominalGrams: 6000000,
      initialGrade2NominalGrams: 4000000,
      nccCountedNets: 500,
      nccTariffId: tariff.id,
      nccComputedPayableCents: 800000,
      isNccCessPaid: true,
      priceG1Cents: 200000,
      minPriceG1Cents: 180000,
      priceG2Cents: 150000,
      minPriceG2Cents: 130000,
      status: 'ACTIVE',
    })
    .returning();

  await db.transaction(async (tx) => {
    await appendStockMovement(tx, {
      masterId: master.id,
      batchId: batch.id,
      grade: 'GRADE_1',
      movementType: 'LOAD',
      deltaNominalGrams: 6000000,
      referenceId: batch.id,
      actorType: 'MASTER',
      actorId: master.id,
    });
    await appendStockMovement(tx, {
      masterId: master.id,
      batchId: batch.id,
      grade: 'GRADE_2',
      movementType: 'LOAD',
      deltaNominalGrams: 4000000,
      referenceId: batch.id,
      actorType: 'MASTER',
      actorId: master.id,
    });
  });

  const [seller] = await db
    .insert(schema.salespeople)
    .values({
      masterId: master.id,
      phoneE164: '+254712345678',
      fullName: 'Kamau Seller',
      nationalId: '28111222',
      status: 'ACTIVE',
      creditCapNominalGrams: 200000,
    })
    .returning();

  const [assignment] = await db
    .insert(schema.stockAssignments)
    .values({
      masterId: master.id,
      batchId: batch.id,
      salespersonId: seller.id,
      expectedPriceG1Cents: 200000,
      expectedPriceG2Cents: 150000,
      status: 'ACTIVE',
    })
    .returning();

  await db.transaction(async (tx) => {
    await appendStockMovement(tx, {
      masterId: master.id,
      batchId: batch.id,
      assignmentId: null,
      grade: 'GRADE_1',
      movementType: 'ALLOCATE',
      deltaNominalGrams: -1000000,
      referenceId: assignment.id,
      actorType: 'MASTER',
      actorId: master.id,
    });
    await appendStockMovement(tx, {
      masterId: master.id,
      batchId: batch.id,
      assignmentId: assignment.id,
      grade: 'GRADE_1',
      movementType: 'ALLOCATE',
      deltaNominalGrams: 1000000,
      referenceId: assignment.id,
      actorType: 'MASTER',
      actorId: master.id,
    });
    await appendStockMovement(tx, {
      masterId: master.id,
      batchId: batch.id,
      assignmentId: null,
      grade: 'GRADE_2',
      movementType: 'ALLOCATE',
      deltaNominalGrams: -400000,
      referenceId: assignment.id,
      actorType: 'MASTER',
      actorId: master.id,
    });
    await appendStockMovement(tx, {
      masterId: master.id,
      batchId: batch.id,
      assignmentId: assignment.id,
      grade: 'GRADE_2',
      movementType: 'ALLOCATE',
      deltaNominalGrams: 400000,
      referenceId: assignment.id,
      actorType: 'MASTER',
      actorId: master.id,
    });
  });

  console.log('[dev-local] Seeded demo store: Seller phone 0712345678 (+254712345678) with 50 G1 + 20 G2 nets');
}

async function ensureStarterBatches(db: AppDb) {
  const assetsDir = path.join(__dirname, '..', 'assets', 'Packaged onions samples');
  let sampleFiles: string[] = [];
  try {
    const all = await fs.readdir(assetsDir);
    sampleFiles = all
      .filter((f) => /^WhatsApp Image.*\.(jpeg|jpg|png)$/i.test(f))
      .sort();
  } catch {
    return;
  }
  if (sampleFiles.length < 4) return;

  const toDataUri = async (idx: number) => {
    const fname = sampleFiles[idx % sampleFiles.length];
    const buf = await fs.readFile(path.join(assetsDir, fname));
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  };

  const allMasters = await db.select().from(schema.masters);
  if (allMasters.length === 0) return;

  const [tariff] = await db.select().from(schema.nccTariffs).limit(1);
  if (!tariff) return;

  const today = getNairobiBusinessDate();

  for (const master of allMasters) {
    // Close any orphan ACTIVE batches that have 0 products so Sales & Products stay in sync
    const activeBatches = await db
      .select()
      .from(schema.truckBatches)
      .where(eq(schema.truckBatches.masterId, master.id));

    for (const b of activeBatches) {
      if (b.status === 'ACTIVE') {
        const prodCountRes = await db.execute(
          sql`SELECT count(*)::int AS c FROM batch_products WHERE batch_id = ${b.id}`
        );
        const pc = Number((prodCountRes.rows[0] as { c: number })?.c ?? 0);
        if (pc === 0) {
          await db
            .update(schema.truckBatches)
            .set({ status: 'CLOSED', closedAt: new Date() })
            .where(eq(schema.truckBatches.id, b.id));
        }
      }
    }

    const totalProdsRes = await db.execute(
      sql`SELECT count(*)::int AS c FROM batch_products WHERE master_id = ${master.id}`
    );
    const totalProds = Number((totalProdsRes.rows[0] as { c: number })?.c ?? 0);
    if (totalProds > 0) continue;

    const specs = [
      {
        batchNumber: 'NAROSURA-15NOV26-DUKEF1',
        truckPlate: 'KDL 031P',
        originRegionId: 'KE-NAROK',
        originRegionName: 'Narosura, Narok',
        originSpecificLocation: 'Narosura',
        title: 'Duke F1',
        g1Nets: 350,
        g2Nets: 50,
        priceG1Cents: 130000,
        minPriceG1Cents: 120000,
        priceG2Cents: 80000,
        minPriceG2Cents: 70000,
        descG1: 'Well cured Narosura Duke F1 Grade 1 bulbs in 20kg net bags.',
        descG2: 'Narosura Duke F1 Grade 2 sorted medium & small bulbs, 20kg net.',
        g1Photos: [await toDataUri(0), await toDataUri(1)],
        g2Photos: [await toDataUri(2), await toDataUri(3)],
      },
      {
        batchNumber: 'SINGIDA-15NOV26-REDCREOLE',
        truckPlate: 'T412 DKP',
        originRegionId: 'TZ-NORTH',
        originRegionName: 'Singida, Tanzania',
        originSpecificLocation: 'Singida',
        title: 'Red Creole',
        g1Nets: 280,
        g2Nets: 40,
        priceG1Cents: 150000,
        minPriceG1Cents: 135000,
        priceG2Cents: 95000,
        minPriceG2Cents: 85000,
        descG1: 'Deep red Singida Tanzania Red Creole Grade 1, dry skin, 20kg net.',
        descG2: 'Singida Red Creole Grade 2 mixed sizes, crisp bulbs in 20kg net.',
        g1Photos: [await toDataUri(4), await toDataUri(5)],
        g2Photos: [await toDataUri(6), await toDataUri(7)],
      },
    ];

    for (const s of specs) {
      const g1Grams = s.g1Nets * 20000;
      const g2Grams = s.g2Nets * 20000;
      const [createdBatch] = await db
        .insert(schema.truckBatches)
        .values({
          masterId: master.id,
          batchNumber: s.batchNumber,
          truckPlate: s.truckPlate,
          originRegionId: s.originRegionId,
          originRegionName: s.originRegionName,
          originSpecificLocation: s.originSpecificLocation,
          businessDate: today,
          dayNumber: 1,
          packagingGrams: 20000,
          netsLoaded: s.g1Nets + s.g2Nets,
          initialGrade1NominalGrams: g1Grams,
          initialGrade2NominalGrams: g2Grams,
          nccCountedNets: s.g1Nets + s.g2Nets,
          nccTariffId: tariff.id,
          nccComputedPayableCents: (s.g1Nets + s.g2Nets) * tariff.ratePerNetCents,
          isNccCessPaid: true,
          priceG1Cents: s.priceG1Cents,
          minPriceG1Cents: s.minPriceG1Cents,
          priceG2Cents: s.priceG2Cents,
          minPriceG2Cents: s.minPriceG2Cents,
          photoUrls: s.g1Photos,
          qualityNotes: s.descG1,
          status: 'ACTIVE',
        })
        .returning();

      await db.transaction(async (tx) => {
        await appendStockMovement(tx, {
          masterId: master.id,
          batchId: createdBatch.id,
          grade: 'GRADE_1',
          movementType: 'LOAD',
          deltaNominalGrams: g1Grams,
          referenceId: createdBatch.id,
          actorType: 'MASTER',
          actorId: master.id,
        });
        await appendStockMovement(tx, {
          masterId: master.id,
          batchId: createdBatch.id,
          grade: 'GRADE_2',
          movementType: 'LOAD',
          deltaNominalGrams: g2Grams,
          referenceId: createdBatch.id,
          actorType: 'MASTER',
          actorId: master.id,
        });
      });

      await db.insert(schema.batchProducts).values([
        {
          masterId: master.id,
          batchId: createdBatch.id,
          title: s.title,
          grade: 'GRADE_1',
          packaging: '20KG_NET',
          weightGrams: 20000,
          priceCents: s.priceG1Cents,
          minPriceCents: s.minPriceG1Cents,
          photoUrl: s.g1Photos[0],
          photoUrls: s.g1Photos,
          description: s.descG1,
          tags: ['New Stock', 'Grade 1', 'Large Size', 'Medium Size'],
        },
        {
          masterId: master.id,
          batchId: createdBatch.id,
          title: s.title,
          grade: 'GRADE_2',
          packaging: '20KG_NET',
          weightGrams: 20000,
          priceCents: s.priceG2Cents,
          minPriceCents: s.minPriceG2Cents,
          photoUrl: s.g2Photos[0],
          photoUrls: s.g2Photos,
          description: s.descG2,
          tags: ['New Stock', 'Grade 2', 'Medium Size', 'Small Size'],
        },
      ]);
    }
    console.log(`[dev-local] Seeded Narok & Tanzania starter batches with asset photos for ${master.fullName}`);
  }
}

async function main() {
  const dataDir = path.join(__dirname, '..', '.local-pgdata');
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;

  const sqlPath = path.join(__dirname, 'db', 'migrations', '0001_init.sql');
  const sqlText = await fs.readFile(sqlPath, 'utf8');
  await pglite.exec(sqlText);
  await pglite.exec('ALTER TABLE sales ADD COLUMN IF NOT EXISTS buyer_name text;');

  const db = drizzle(pglite, { schema }) as unknown as AppDb;
  await seedDemoWorkspaceIfEmpty(db);
  await ensureStarterBatches(db);

  const config: AppConfig = {
    NODE_ENV: 'development',
    PORT: Number(process.env.PORT || 3001),
    HOST: '0.0.0.0',
    DATABASE_URL: 'pglite://local',
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    SELLER_JWT_SECRET: process.env.SELLER_JWT_SECRET || 'dev-seller-jwt-secret-change-in-prod-32c',
    SMS_PROVIDER: 'console',
    AFRICASTALKING_SENDER_ID: 'THEGEM',
  };

  const clerkVerifier = createClerkTokenVerifier(config.CLERK_SECRET_KEY);
  const smsProvider = new ConsoleSmsProvider();

  const { app } = await buildApp({
    db,
    config,
    clerkVerifier,
    smsProvider,
  });

  // Dev-only M-Pesa SMS simulator bridge for testing OTP-style auto-fill in Expo Go
  let latestSimulatedSms: {
    id: string;
    sender: string;
    body: string;
    receivedAt: string;
  } | null = null;

  app.post('/dev/simulate-mpesa-sms', async (request) => {
    const body = (request.body ?? {}) as { sender?: string; body?: string };
    latestSimulatedSms = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender: body.sender || 'MPESA',
      body: String(body.body || ''),
      receivedAt: new Date().toISOString(),
    };
    console.log(`[dev-local] Simulated incoming SMS from ${latestSimulatedSms.sender}: ${latestSimulatedSms.body}`);
    return { ok: true, sms: latestSimulatedSms };
  });

  app.get('/dev/latest-mpesa-sms', async () => {
    return { sms: latestSimulatedSms };
  });

  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(`[dev-local] Fastify backend listening on http://${config.HOST}:${config.PORT}`);
}

main().catch((err) => {
  console.error('[dev-local] Failed to start:', err);
  process.exit(1);
});
