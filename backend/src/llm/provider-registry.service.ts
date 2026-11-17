import { Injectable, Logger } from '@nestjs/common';
import { ClaudeProviderService } from './claude-provider.service';
import { GeminiProviderService } from './gemini-provider.service';
import { HeuristicProviderService } from './heuristic-provider.service';
import { LocalLlmProviderService } from './local-llm-provider.service';
import { OpenAiProviderService } from './openai-provider.service';
import { SettingsService } from '../settings/settings.service';
import type { LLMProvider, ProviderName } from './llm-provider.interface';
import { withRetry } from './with-retry';

export interface ReaderFailure {
  provider: ProviderName;
  message: string;
  at: string;
}

@Injectable()
export class ProviderRegistryService {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private lastFailure: ReaderFailure | null = null;
  private readonly providers: LLMProvider[];

  constructor(
    openai: OpenAiProviderService,
    claude: ClaudeProviderService,
    gemini: GeminiProviderService,
    local: LocalLlmProviderService,
    heuristic: HeuristicProviderService,
    private readonly settings: SettingsService,
  ) {
    this.providers = [openai, gemini, claude, local, heuristic];
  }

  get(name: ProviderName): LLMProvider | undefined {
    return this.providers.find((provider) => provider.name === name);
  }

  fallbackChain(): LLMProvider[] {
    const chosen = this.settings.preferredReader();
    const chain: LLMProvider[] = [];
    if (chosen !== 'builtin') {
      const selected = this.get(chosen);
      if (selected?.isConfigured()) chain.push(selected);
    }
    const builtin = this.get('heuristic');
    if (builtin) chain.push(builtin);
    return chain;
  }

  async runWithFallback<T>(
    fn: (provider: LLMProvider) => Promise<T>,
  ): Promise<T> {
    const chain = this.fallbackChain();
    let lastError: unknown;
    for (const provider of chain) {
      try {
        const result = await withRetry(() => fn(provider), {
          retries: provider.name === 'heuristic' ? 0 : 1,
          timeoutMs: provider.name === 'heuristic' ? 5_000 : 30_000,
        });
        if (provider.name !== 'heuristic' && this.lastFailure?.provider === provider.name) {
          this.lastFailure = null;
        }
        return result;
      } catch (error) {
        lastError = error;
        if (provider.name !== 'heuristic') {
          this.lastFailure = {
            provider: provider.name,
            message: readerErrorMessage(error),
            at: new Date().toISOString(),
          };
        }
        this.logger.warn(
          `${provider.name} (${provider.model}) failed, trying next reader: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Scoring is unavailable right now. Try again.');
  }

  status() {
    return {
      using: this.settings.preferredReader(),
      lastFailure: this.lastFailure,
    };
  }

  async extractWithFallback(resumeText: string) {
    return this.runWithFallback((provider) =>
      provider.extractResumeData(resumeText),
    );
  }
}

function readerErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number })?.status;
  if (/credit balance|insufficient_quota|exceeded your current quota|billing/i.test(raw)) {
    return 'The account has run out of credit. Top it up with the provider, or pick another reader in Settings.';
  }
  if (status === 401 || status === 403 || /api key|x-api-key|permission denied/i.test(raw)) {
    return 'The API key was rejected. Paste a fresh key in Settings.';
  }
  if (status === 429) {
    return 'The provider is rate-limiting requests. Reads will work again shortly.';
  }
  if (/model/i.test(raw) && (status === 404 || status === 400)) {
    return 'The provider no longer offers the model MG-ATS asked for.';
  }
  return raw.replace(/(sk|AIza)[A-Za-z0-9_*\-]{6,}/g, '••••').slice(0, 200);
}
