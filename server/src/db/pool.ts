import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export function resolvePgSsl(connectionString: string) {
  if (/localhost|127\.0\.0\.1|sslmode=disable/i.test(connectionString)) {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

export function createDbPool(connectionString: string, max = 10) {
  const pool = new Pool({
    connectionString,
    max,
    ssl: resolvePgSsl(connectionString),
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

export type AppDb = ReturnType<typeof createDbPool>['db'];
