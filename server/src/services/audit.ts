import type { AppDb } from '../db/pool.js';
import { auditEvents } from '../db/schema.js';

export type DbOrTx = Pick<AppDb, 'insert'>;

export interface AuditInput {
  masterId?: string | null;
  actorType: 'MASTER' | 'SELLER' | 'SYSTEM' | 'ANONYMOUS';
  actorId?: string | null;
  actorRole?: string | null;
  deviceId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  beforeState?: unknown;
  afterState?: unknown;
  clientTime?: Date | null;
}

export async function writeAuditEvent(db: DbOrTx, input: AuditInput) {
  await db.insert(auditEvents).values({
    masterId: input.masterId ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    deviceId: input.deviceId ?? null,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    outcome: input.outcome,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    clientTime: input.clientTime ?? null,
  });
}
