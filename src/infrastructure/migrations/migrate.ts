import * as fs from 'fs';
import * as path from 'path';
import { getClient } from '../database';

/**
 * Creates the schema_migrations tracking table if it does not exist.
 * Each applied migration is recorded by filename so it is never re-executed.
 */
async function ensureMigrationsTable(client: import('pg').PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
}

/**
 * Returns the set of migration filenames that have already been applied.
 */
async function getAppliedMigrations(client: import('pg').PoolClient): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );
  return new Set(result.rows.map((row) => row.filename));
}

/**
 * Returns the sorted list of *.sql files in the migrations directory.
 */
function getMigrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order ensures 001_, 002_, … run in sequence
}

/**
 * Applies all pending SQL migration files in order.
 * Each migration runs inside its own transaction so a failure rolls back
 * only that file and leaves already-applied migrations intact.
 */
async function migrate(): Promise<void> {
  const migrationsDir = path.join(__dirname);

  const files = getMigrationFiles(migrationsDir);
  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  // Use a single client throughout so the schema_migrations table is visible
  // inside the same session even before COMMIT (not strictly necessary with
  // shared pool, but keeps the logic clear).
  const client = await getClient();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('All migrations are already up to date.');
      return;
    }

    for (const filename of pending) {
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`Applying migration: ${filename} …`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        console.log(`  ✓ ${filename} applied successfully.`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✗ ${filename} failed — rolling back:`, err);
        throw err; // abort the whole migration run on first failure
      }
    }

    console.log(`Migration complete. ${pending.length} file(s) applied.`);
  } finally {
    client.release();
  }
}

// Run when executed directly: ts-node migrate.ts  or  node dist/migrate.js
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration run failed:', err);
      process.exit(1);
    });
}

export { migrate };
