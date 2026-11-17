import { Controller, Get } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';

@Controller('llm')
export class LlmController {
  constructor(private registry: ProviderRegistryService) {}

  @Get('status')
  status() {
    return this.registry.status();
  }

  @Get('providers')
  availability() {
    return { ready: this.registry.fallbackChain().length > 0 };
  }
}
