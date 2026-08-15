import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { JobsModule } from './jobs/jobs.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ApplicationsModule } from './applications/applications.module';
import { BatchesModule } from './batches/batches.module';
import { ScoresModule } from './scores/scores.module';
import { InterviewQuestionsModule } from './interview-questions/interview-questions.module';
import { LlmModule } from './llm/llm.module';
import { QueueModule } from './queue/queue.module';
import { ProcessingModule } from './processing/processing.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    JobsModule,
    CandidatesModule,
    ApplicationsModule,
    BatchesModule,
    ScoresModule,
    InterviewQuestionsModule,
    LlmModule,
    QueueModule,
    ProcessingModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
