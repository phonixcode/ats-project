import { Test, TestingModule } from '@nestjs/testing';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { ProcessingService } from '../processing/processing.service';

describe('BatchesController', () => {
  let controller: BatchesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BatchesController],
      providers: [
        { provide: BatchesService, useValue: {} },
        { provide: ProcessingService, useValue: { enqueueArchive: jest.fn() } },
      ],
    }).compile();

    controller = module.get<BatchesController>(BatchesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
