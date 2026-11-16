import { loadConfig } from './config.js';
import { createDbPool } from './db/pool.js';
import { createClerkTokenVerifier } from './auth/tokens.js';
import { AfricasTalkingSmsProvider, ConsoleSmsProvider, SimGatewaySmsProvider } from './providers/sms.js';
import { startScheduler } from './jobs/scheduler.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const { pool, db } = createDbPool(config.DATABASE_URL);
  const clerkVerifier = createClerkTokenVerifier(config.CLERK_SECRET_KEY);
  const smsProvider =
    config.SMS_PROVIDER === 'africastalking' &&
    config.AFRICASTALKING_API_KEY &&
    config.AFRICASTALKING_USERNAME
      ? new AfricasTalkingSmsProvider(
          config.AFRICASTALKING_API_KEY,
          config.AFRICASTALKING_USERNAME,
          config.AFRICASTALKING_SENDER_ID
        )
      : config.SMS_PROVIDER === 'sim_gateway'
        ? new SimGatewaySmsProvider()
        : new ConsoleSmsProvider();

  const { app } = await buildApp({
    db,
    config,
    clerkVerifier,
    smsProvider,
  });

  const boss = await startScheduler(db, config.DATABASE_URL, smsProvider);

  const shutdown = async () => {
    await boss.stop();
    await app.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(`Server listening on port ${config.PORT}`);
}

main().catch((err) => {
  console.error('Fatal server error:', err);
  process.exit(1);
});
