import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export function createDbPool(connectionString: string, max = 10) {
  const pool = new Pool({ connectionString, max });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

export type AppDb = ReturnType<typeof createDbPool>['db'];
