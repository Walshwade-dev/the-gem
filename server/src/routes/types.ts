import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppConfig } from '../config.js';
import { AppDb } from '../db/pool.js';
import { ClerkTokenVerifier } from '../auth/tokens.js';
import { CompositeNotifier, SseHub } from '../providers/notifier.js';
import { SmsProvider } from '../providers/sms.js';

export interface AppRouteDeps {
  db: AppDb;
  config: AppConfig;
  clerkVerifier: ClerkTokenVerifier;
  smsProvider: SmsProvider;
  notifier: CompositeNotifier;
  sseHub: SseHub;
}

export function sendValidationError(reply: FastifyReply, err: ZodError) {
  return reply.code(400).send({
    error: 'VALIDATION_ERROR',
    issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
