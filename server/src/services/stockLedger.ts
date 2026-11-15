import { sql } from 'drizzle-orm';
import type { AppDb } from '../db/pool.js';
import { stockMovements } from '../db/schema.js';

export type Tx = Parameters<Parameters<AppDb['transaction']>[0]>[0];

/**
 * Computes available nominal grams in the batch pool (not allocated to active assignments
 * and not sold/reserved by Master). Must be called inside a transaction after locking the batch row.
 */
export async function getBatchPoolNominalGrams(
  tx: AppDb | Tx,
  batchId: string,
  grade: 'GRADE_1' | 'GRADE_2'
): Promise<number> {
  const res = await tx.execute(sql`
    SELECT COALESCE(SUM(delta_nominal_grams), 0)::int AS balance
    FROM stock_movements
    WHERE batch_id = ${batchId}
      AND assignment_id IS NULL
      AND grade = ${grade}
  `);
  const row = res.rows[0] as { balance: number } | undefined;
  return Number(row?.balance ?? 0);
}

/**
 * Computes available nominal grams on a specific assignment (allocated + topup - sold - reserved).
 * Must be called inside a transaction after locking the assignment row.
 */
export async function getAssignmentAvailableNominalGrams(
  tx: AppDb | Tx,
  assignmentId: string,
  grade: 'GRADE_1' | 'GRADE_2'
): Promise<number> {
  const res = await tx.execute(sql`
    SELECT COALESCE(SUM(delta_nominal_grams), 0)::int AS balance
    FROM stock_movements
    WHERE assignment_id = ${assignmentId}
      AND grade = ${grade}
  `);
  const row = res.rows[0] as { balance: number } | undefined;
  return Number(row?.balance ?? 0);
}

/**
 * Computes how many nominal grams have been sold (SALE + SALE_REVERSAL) on an assignment.
 */
export async function getAssignmentSoldNominalGrams(
  tx: Tx,
  assignmentId: string,
  grade: 'GRADE_1' | 'GRADE_2'
): Promise<number> {
  const res = await tx.execute(sql`
    SELECT COALESCE(-SUM(delta_nominal_grams), 0)::int AS sold
    FROM stock_movements
    WHERE assignment_id = ${assignmentId}
      AND grade = ${grade}
      AND movement_type IN ('SALE', 'SALE_REVERSAL')
  `);
  const row = res.rows[0] as { sold: number } | undefined;
  return Math.max(0, Number(row?.sold ?? 0));
}

export async function appendStockMovement(
  tx: Tx,
  params: {
    masterId: string;
    batchId: string;
    assignmentId?: string | null;
    grade: 'GRADE_1' | 'GRADE_2';
    movementType:
      | 'LOAD'
      | 'ALLOCATE'
      | 'TOPUP'
      | 'RESERVE'
      | 'RELEASE'
      | 'SALE'
      | 'SALE_REVERSAL'
      | 'RETURN'
      | 'WRITE_OFF';
    deltaNominalGrams: number;
    referenceId?: string | null;
    actorType: 'MASTER' | 'SELLER' | 'SYSTEM';
    actorId: string;
  }
) {
  await tx.insert(stockMovements).values({
    masterId: params.masterId,
    batchId: params.batchId,
    assignmentId: params.assignmentId ?? null,
    grade: params.grade,
    movementType: params.movementType,
    deltaNominalGrams: params.deltaNominalGrams,
    referenceId: params.referenceId ?? null,
    actorType: params.actorType,
    actorId: params.actorId,
  });
}
