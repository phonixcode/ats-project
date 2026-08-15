import { Injectable } from '@nestjs/common';
import { ClaudeProviderService } from './claude-provider.service';
import { GeminiProviderService } from './gemini-provider.service';
import { HeuristicProviderService } from './heuristic-provider.service';
import { LocalLlmProviderService } from './local-llm-provider.service';
import { OpenAiProviderService } from './openai-provider.service';
import { SettingsService } from '../settings/settings.service';
import type { LLMProvider, ProviderName } from './llm-provider.interface';
import { withRetry } from './with-retry';

@Injectable()
export class ProviderRegistryService {
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
        return await withRetry(() => fn(provider), {
          retries: provider.name === 'heuristic' ? 0 : 1,
          timeoutMs: provider.name === 'heuristic' ? 5_000 : 30_000,
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Scoring is unavailable right now. Try again.');
  }

  async extractWithFallback(resumeText: string) {
    return this.runWithFallback((provider) =>
      provider.extractResumeData(resumeText),
    );
  }
}
