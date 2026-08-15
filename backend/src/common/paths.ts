import { totalmem } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';

export function dataDir(): string {
  if (process.env.MG_ATS_DATA_DIR) return process.env.MG_ATS_DATA_DIR;
  return join(process.cwd(), 'data');
}

export function ensureDataDir(): string {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'uploads', 'incoming'), { recursive: true });
  mkdirSync(join(dir, 'models'), { recursive: true });
  mkdirSync(join(dir, 'logs'), { recursive: true });
  return dir;
}

export function databaseFile(): string {
  return process.env.DATABASE_URL?.startsWith('file:')
    ? process.env.DATABASE_URL.slice('file:'.length)
    : join(dataDir(), 'mg-ats.db');
}

export function databaseUrl(): string {
  if (process.env.DATABASE_URL?.startsWith('file:')) return process.env.DATABASE_URL;
  return `file:${databaseFile()}`;
}

export function scoringConcurrency(): number {
  const forced = Number(process.env.MG_ATS_CONCURRENCY);
  if (Number.isFinite(forced) && forced >= 1) return Math.min(4, Math.floor(forced));
  const gb = totalmem() / 1024 ** 3;
  return gb >= 16 ? 2 : 1;
}
