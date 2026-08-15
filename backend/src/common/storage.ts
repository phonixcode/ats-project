import { join } from 'path';
import { mkdirSync } from 'fs';
import { dataDir, ensureDataDir } from './paths';

export function uploadsRoot(): string {
  ensureDataDir();
  return join(dataDir(), 'uploads');
}

export function batchDir(batchId: string): string {
  const dir = join(uploadsRoot(), batchId);
  mkdirSync(dir, { recursive: true });
  return dir;
}
