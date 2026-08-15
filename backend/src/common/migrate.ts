import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { databaseFile } from './paths';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'prisma', 'migrations');

export function runMigrations(): void {
  if (!existsSync(MIGRATIONS_DIR)) return;

  const file = databaseFile();
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
      );
    `);

    const applied = new Set(
      db
        .prepare(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
        )
        .all()
        .map((row: any) => row.migration_name as string),
    );

    const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    if (applied.size === 0) {
      const hasExistingSchema = (
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'`,
          )
          .get() as { c: number }
      ).c > 0;
      if (hasExistingSchema) {
        // Database already has tables (e.g. built via `prisma db push`) but no
        // migration history. Treat the current schema as the baseline instead
        // of re-running CREATE TABLE against tables that already exist.
        const mark = db.prepare(
          `INSERT INTO "_prisma_migrations"
            (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES (?, ?, datetime('now'), ?, datetime('now'), 1)`,
        );
        for (const name of migrations) {
          mark.run(randomUUID(), 'baseline', name);
        }
        return;
      }
    }

    for (const name of migrations) {
      if (applied.has(name)) continue;
      const sqlPath = join(MIGRATIONS_DIR, name, 'migration.sql');
      if (!existsSync(sqlPath)) continue;
      const sql = readFileSync(sqlPath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      const apply = db.transaction(() => {
        db.exec(sql);
        db.prepare(
          `INSERT INTO "_prisma_migrations"
            (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES (?, ?, datetime('now'), ?, datetime('now'), 1)`,
        ).run(randomUUID(), checksum, name);
      });
      apply();
    }
  } finally {
    db.close();
  }
}
