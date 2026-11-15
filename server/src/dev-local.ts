import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
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

async function main() {
  const dataDir = path.join(__dirname, '..', '.local-pgdata');
  const pglite = new PGlite(dataDir);
  await pglite.waitReady;

  const sqlPath = path.join(__dirname, 'db', 'migrations', '0001_init.sql');
  const sqlText = await fs.readFile(sqlPath, 'utf8');
  await pglite.exec(sqlText);

  const db = drizzle(pglite, { schema }) as unknown as AppDb;
  await seedDemoWorkspaceIfEmpty(db);

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

  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(`[dev-local] Fastify backend listening on http://${config.HOST}:${config.PORT}`);
}

main().catch((err) => {
  console.error('[dev-local] Failed to start:', err);
  process.exit(1);
});
