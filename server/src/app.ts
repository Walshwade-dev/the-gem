import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig } from './config.js';
import { AppDb } from './db/pool.js';
import { ClerkTokenVerifier } from './auth/tokens.js';
import { CompositeNotifier, SseHub } from './providers/notifier.js';
import { ConsoleSmsProvider, SmsProvider } from './providers/sms.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBatchRoutes } from './routes/batches.js';
import { registerAssignmentRoutes } from './routes/assignments.js';
import { registerSalesRoutes } from './routes/sales.js';
import { registerOperationsRoutes } from './routes/operations.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerMpesaRoutes } from './routes/mpesa.js';
import { IdempotencyConflictError } from './services/idempotency.js';

export interface BuildAppOptions {
  db: AppDb;
  config: AppConfig;
  clerkVerifier: ClerkTokenVerifier;
  smsProvider?: SmsProvider;
}

export async function buildApp(opts: BuildAppOptions): Promise<{
  app: FastifyInstance;
  sseHub: SseHub;
  smsProvider: SmsProvider;
  notifier: CompositeNotifier;
}> {
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024 });
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key'],
  });
  const sseHub = new SseHub();
  const smsProvider = opts.smsProvider ?? new ConsoleSmsProvider();
  const notifier = new CompositeNotifier(
    opts.db,
    sseHub,
    opts.config.EXPO_PUSH_ACCESS_TOKEN
  );

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _request, reply) => {
    if (err instanceof IdempotencyConflictError) {
      return reply.code(409).send({ error: err.code, message: err.message });
    }
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (status === 500) {
      console.error('Unhandled 500 error:', err);
    }
    return reply.code(status).send({
      error: err.code ?? 'INTERNAL_ERROR',
      message: err.message,
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  const deps = {
    db: opts.db,
    config: opts.config,
    clerkVerifier: opts.clerkVerifier,
    smsProvider,
    notifier,
    sseHub,
  };

  await registerAuthRoutes(app, deps);
  await registerBatchRoutes(app, deps);
  await registerAssignmentRoutes(app, deps);
  await registerSalesRoutes(app, deps);
  await registerOperationsRoutes(app, deps);
  await registerSyncRoutes(app, deps);
  await registerMpesaRoutes(app, deps);

  return { app, sseHub, smsProvider, notifier };
}
