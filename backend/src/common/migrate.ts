import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { databaseFile } from './paths';

const MIGRATIONS_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'migrations',
);

const BACKUPS_KEPT = 5;

function backupDatabase(
  db: Database.Database,
  file: string,
  firstPending: string,
): void {
  const dir = join(dirname(file), 'backups');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(dir, `mg-ats-${stamp}-before-${firstPending}.db`);
  db.prepare('VACUUM INTO ?').run(target);

  const old = readdirSync(dir)
    .filter((name) => name.startsWith('mg-ats-') && name.endsWith('.db'))
    .sort()
    .slice(0, -BACKUPS_KEPT);
  for (const name of old) rmSync(join(dir, name), { force: true });
}

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
        .map((row) => (row as { migration_name: string }).migration_name),
    );

    const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const hasExistingSchema =
      (
        db
          .prepare(
            `SELECT COUNT(*) AS c FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'`,
          )
          .get() as { c: number }
      ).c > 0;

    const record = db.prepare(
      `INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
       VALUES (?, ?, datetime('now'), ?, datetime('now'), 1)`,
    );

    if (applied.size === 0 && hasExistingSchema && migrations.length > 0) {
      // Pre-history databases were created from the first migration's schema only.
      record.run(randomUUID(), 'baseline', migrations[0]);
      applied.add(migrations[0]);
    }

    const pending = migrations.filter(
      (name) =>
        !applied.has(name) &&
        existsSync(join(MIGRATIONS_DIR, name, 'migration.sql')),
    );
    if (pending.length === 0) return;
    if (hasExistingSchema) backupDatabase(db, file, pending[0]);

    // Table rebuilds DROP the old table; with foreign keys on, that cascades and deletes child rows.
    db.pragma('foreign_keys = OFF');
    try {
      for (const name of pending) {
        const sql = readFileSync(
          join(MIGRATIONS_DIR, name, 'migration.sql'),
          'utf8',
        );
        const checksum = createHash('sha256').update(sql).digest('hex');
        db.transaction(() => {
          db.exec(sql);
          const broken = db.pragma('foreign_key_check') as unknown[];
          if (broken.length > 0) {
            throw new Error(
              `Database update ${name} would break ${broken.length} links between records`,
            );
          }
          record.run(randomUUID(), checksum, name);
        })();
      }
    } finally {
      db.pragma('foreign_keys = ON');
    }
  } finally {
    db.close();
  }
}
