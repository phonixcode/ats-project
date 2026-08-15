import { Test, TestingModule } from '@nestjs/testing';
import { InterviewQuestionsController } from './interview-questions.controller';
import { InterviewQuestionsService } from './interview-questions.service';

describe('InterviewQuestionsController', () => {
  let controller: InterviewQuestionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewQuestionsController],
      providers: [{ provide: InterviewQuestionsService, useValue: {} }],
    }).compile();

    controller = module.get<InterviewQuestionsController>(
      InterviewQuestionsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
