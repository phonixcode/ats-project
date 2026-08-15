import { Injectable } from '@nestjs/common';
import {
  SettingsRepository,
  type CloudProvider,
  type ReaderChoice,
  type StoredSettings,
} from './settings.repository';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

const ENV_KEY: Record<CloudProvider, string> = {
  openai: 'OPENAI_API_KEY',
  claude: 'CLAUDE_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

type KeyField = 'openaiApiKey' | 'claudeApiKey' | 'geminiApiKey';

const FILE_KEY: Record<CloudProvider, KeyField> = {
  openai: 'openaiApiKey',
  claude: 'claudeApiKey',
  gemini: 'geminiApiKey',
};

const CLOUD_ORDER: CloudProvider[] = ['openai', 'claude', 'gemini'];

export interface CloudKeyStatus {
  configured: boolean;
  hint: string | null;
}

export interface SettingsSnapshot {
  openai: CloudKeyStatus;
  claude: CloudKeyStatus;
  gemini: CloudKeyStatus;
  using: ReaderChoice;
}

@Injectable()
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  cloudKey(provider: CloudProvider): string | null {
    const stored = this.repository.read()[FILE_KEY[provider]]?.trim();
    if (stored) return stored;
    const fromEnv = process.env[ENV_KEY[provider]]?.trim();
    return fromEnv || null;
  }

  preferredReader(): ReaderChoice {
    const stored = this.repository.read().reader;
    if (stored === 'builtin' || stored === 'openai' || stored === 'claude' || stored === 'gemini') {
      return stored;
    }
    return CLOUD_ORDER.find((name) => this.cloudKey(name)) ?? 'builtin';
  }

  snapshot(): SettingsSnapshot {
    return {
      openai: this.status('openai'),
      claude: this.status('claude'),
      gemini: this.status('gemini'),
      using: this.preferredReader(),
    };
  }

  update(dto: UpdateSettingsDto): SettingsSnapshot {
    const current = this.repository.read();
    const next: StoredSettings = { ...current };
    if (dto.reader) next.reader = dto.reader;
    this.applyKey(next, 'openaiApiKey', dto.openaiApiKey);
    this.applyKey(next, 'claudeApiKey', dto.claudeApiKey);
    this.applyKey(next, 'geminiApiKey', dto.geminiApiKey);
    this.repository.write(next);
    return this.snapshot();
  }

  private status(provider: CloudProvider): CloudKeyStatus {
    const key = this.cloudKey(provider);
    return { configured: Boolean(key), hint: this.hint(key) };
  }

  private hint(key: string | null): string | null {
    if (!key) return null;
    if (key.length < 4) return 'Saved';
    return `••••${key.slice(-4)}`;
  }

  private applyKey(
    target: StoredSettings,
    field: KeyField,
    value: string | undefined,
  ): void {
    if (value === undefined) return;
    if (!value) {
      delete target[field];
      return;
    }
    target[field] = value;
  }
}
