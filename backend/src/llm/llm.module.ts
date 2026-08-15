import { Module } from '@nestjs/common';
import { OpenAiProviderService } from './openai-provider.service';
import { ClaudeProviderService } from './claude-provider.service';
import { GeminiProviderService } from './gemini-provider.service';
import { LocalLlmProviderService } from './local-llm-provider.service';
import { HeuristicProviderService } from './heuristic-provider.service';
import { ProviderRegistryService } from './provider-registry.service';
import { LlmController } from './llm.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [LlmController],
  providers: [
    OpenAiProviderService,
    ClaudeProviderService,
    GeminiProviderService,
    LocalLlmProviderService,
    HeuristicProviderService,
    ProviderRegistryService,
  ],
  exports: [ProviderRegistryService],
})
export class LlmModule {}
