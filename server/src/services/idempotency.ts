import { and, eq } from 'drizzle-orm';
import { AppDb } from '../db/pool.js';
import { idempotencyKeys } from '../db/schema.js';
import { sha256Hex } from '../auth/tokens.js';

export class IdempotencyConflictError extends Error {
  statusCode = 409;
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface IdempotencyResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

export async function withIdempotency<T>(params: {
  db: AppDb;
  key: string | undefined;
  masterId: string;
  actorId: string;
  route: string;
  requestBody: unknown;
  handler: () => Promise<{ status: number; body: T }>;
}): Promise<IdempotencyResult<T>> {
  const { db, key, masterId, actorId, route, requestBody, handler } = params;

  if (!key || key.trim() === '') {
    const res = await handler();
    return { ...res, replayed: false };
  }

  const trimmedKey = key.trim();
  const requestHash = sha256Hex(JSON.stringify(requestBody ?? null));

  const inserted = await db
    .insert(idempotencyKeys)
    .values({
      key: trimmedKey,
      masterId,
      actorId,
      route,
      requestHash,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (inserted.length === 0) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, trimmedKey),
          eq(idempotencyKeys.actorId, actorId),
          eq(idempotencyKeys.route, route)
        )
      )
      .limit(1);

    if (!existing) {
      throw new IdempotencyConflictError(
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key conflict'
      );
    }
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError(
        'IDEMPOTENCY_KEY_REUSE',
        'Idempotency key already used with different request payload'
      );
    }
    if (existing.responseStatus !== null && existing.responseBody !== null) {
      return {
        status: existing.responseStatus,
        body: existing.responseBody as T,
        replayed: true,
      };
    }
    throw new IdempotencyConflictError(
      'IDEMPOTENCY_IN_FLIGHT',
      'Request with this idempotency key is already in progress'
    );
  }

  try {
    const result = await handler();
    await db
      .update(idempotencyKeys)
      .set({
        responseStatus: result.status,
        responseBody: result.body as unknown as Record<string, unknown>,
      })
      .where(
        and(
          eq(idempotencyKeys.key, trimmedKey),
          eq(idempotencyKeys.actorId, actorId),
          eq(idempotencyKeys.route, route)
        )
      );
    return { ...result, replayed: false };
  } catch (err) {
    await db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.key, trimmedKey),
          eq(idempotencyKeys.actorId, actorId),
          eq(idempotencyKeys.route, route)
        )
      );
    throw err;
  }
}
