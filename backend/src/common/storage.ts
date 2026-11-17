import { join, posix } from 'path';
import { mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
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

export function resumeFilePath(destDir: string, originalName: string): string {
  const name = posix
    .basename(originalName.replace(/\\/g, '/'))
    .replace(/[<>:"|?*\x00-\x1f]/g, '_');
  const dir = join(destDir, randomBytes(4).toString('hex'));
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}
