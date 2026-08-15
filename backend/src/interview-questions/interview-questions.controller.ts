import { Controller, Post, Get, Param } from '@nestjs/common';
import { InterviewQuestionsService } from './interview-questions.service';

@Controller('applications/:applicationId/interview-questions')
export class InterviewQuestionsController {
  constructor(private interviewQuestionsService: InterviewQuestionsService) {}

  @Post()
  generate(@Param('applicationId') applicationId: string) {
    return this.interviewQuestionsService.generateForApplication(applicationId);
  }

  @Get()
  findAll(@Param('applicationId') applicationId: string) {
    return this.interviewQuestionsService.findByApplication(applicationId);
  }
}
