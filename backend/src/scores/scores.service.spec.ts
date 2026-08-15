import { Test, TestingModule } from '@nestjs/testing';
import { ScoresService } from './scores.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScoresService', () => {
  let service: ScoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoresService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<ScoresService>(ScoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
