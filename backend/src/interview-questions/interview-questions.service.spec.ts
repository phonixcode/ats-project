import { Test, TestingModule } from '@nestjs/testing';
import { InterviewQuestionsService } from './interview-questions.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistryService } from '../llm/provider-registry.service';

describe('InterviewQuestionsService', () => {
  let service: InterviewQuestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewQuestionsService,
        { provide: PrismaService, useValue: {} },
        { provide: ProviderRegistryService, useValue: {} },
      ],
    }).compile();

    service = module.get<InterviewQuestionsService>(InterviewQuestionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
