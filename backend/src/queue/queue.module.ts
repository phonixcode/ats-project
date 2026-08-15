import { Module } from '@nestjs/common';
import { BatchProcessor } from './batch-processor';
import { ParseProcessor } from './parse-processor';
import { ArchiveExtractionService } from '../batches/archive-extraction.service';
import { ResumeParserService } from '../applications/resume-parser.service';
import { BatchesModule } from '../batches/batches.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { ApplicationsModule } from '../applications/applications.module';
import { LlmModule } from '../llm/llm.module';
import { ExtractionProcessor } from './extraction-processor';
import { ScoresModule } from '../scores/scores.module';
import { ScoringProcessor } from './scoring-processor';
import { DesktopQueueService } from './desktop-queue.service';

@Module({
  imports: [
    BatchesModule,
    CandidatesModule,
    ApplicationsModule,
    LlmModule,
    ScoresModule,
  ],
  providers: [
    DesktopQueueService,
    BatchProcessor,
    ParseProcessor,
    ArchiveExtractionService,
    ResumeParserService,
    ExtractionProcessor,
    ScoringProcessor,
  ],
  exports: [DesktopQueueService],
})
export class QueueModule {}
