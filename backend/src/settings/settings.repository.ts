import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import { dataDir } from '../common/paths';

export type CloudProvider = 'openai' | 'claude' | 'gemini';
export type ReaderChoice = CloudProvider | 'builtin';

export interface StoredSettings {
  reader?: ReaderChoice;
  openaiApiKey?: string;
  claudeApiKey?: string;
  geminiApiKey?: string;
}

@Injectable()
export class SettingsRepository {
  filePath(): string {
    return join(dataDir(), 'settings.json');
  }

  read(): StoredSettings {
    const file = this.filePath();
    if (!existsSync(file)) return {};
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as StoredSettings;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  write(settings: StoredSettings): void {
    const file = this.filePath();
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
    renameSync(tmp, file);
    try {
      chmodSync(file, 0o600);
    } catch {
      /* Windows */
    }
  }
}
