import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(connectionString: string, appRoleName?: string) {
  const pool = new Pool({ connectionString });
  try {
    const sqlPath = path.join(__dirname, 'migrations', '0001_init.sql');
    const sqlText = await fs.readFile(sqlPath, 'utf8');
    await pool.query(sqlText);

    if (appRoleName) {
      // Grant DML on all tables to appRoleName, then REVOKE UPDATE, DELETE on append-only tables
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${appRoleName}') THEN
            GRANT USAGE ON SCHEMA public TO ${appRoleName};
            GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appRoleName};
            GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRoleName};
            REVOKE UPDATE, DELETE ON audit_events FROM ${appRoleName};
            REVOKE UPDATE, DELETE ON stock_movements FROM ${appRoleName};
            REVOKE UPDATE, DELETE ON variance_explanations FROM ${appRoleName};
          END IF;
        END
        $$;
      `);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  const url = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Missing MIGRATOR_DATABASE_URL or DATABASE_URL');
    process.exit(1);
  }
  runMigrations(url, 'app_user')
    .then(() => {
      console.log('Migrations applied successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
