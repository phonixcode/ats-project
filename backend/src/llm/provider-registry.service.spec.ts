import { ProviderRegistryService } from './provider-registry.service';
import type { LLMProvider } from './llm-provider.interface';

function stub(name: LLMProvider['name'], configured: boolean): LLMProvider {
  return {
    name,
    model: name,
    isConfigured: () => configured,
    extractResumeData: async () => {
      throw new Error('unused');
    },
    scoreFit: async () => {
      throw new Error('unused');
    },
    assessAuthenticity: async () => {
      throw new Error('unused');
    },
    generateInterviewQuestions: async () => {
      throw new Error('unused');
    },
  };
}

function settings(reader: 'openai' | 'claude' | 'gemini' | 'builtin') {
  return { preferredReader: () => reader } as never;
}

describe('ProviderRegistryService', () => {
  it('uses only the reader they picked, then the built-in pass', () => {
    const registry = new ProviderRegistryService(
      stub('openai', true) as never,
      stub('claude', true) as never,
      stub('gemini', false) as never,
      stub('local', false) as never,
      stub('heuristic', true) as never,
      settings('claude'),
    );
    expect(registry.fallbackChain().map((provider) => provider.name)).toEqual([
      'claude',
      'heuristic',
    ]);
  });

  it('uses the built-in reader when they pick it, even if a cloud key exists', () => {
    const registry = new ProviderRegistryService(
      stub('openai', true) as never,
      stub('claude', false) as never,
      stub('gemini', false) as never,
      stub('local', false) as never,
      stub('heuristic', true) as never,
      settings('builtin'),
    );
    expect(registry.fallbackChain().map((provider) => provider.name)).toEqual([
      'heuristic',
    ]);
  });
});
