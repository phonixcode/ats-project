import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { scoringConcurrency } from '../common/paths';
import { InProcessQueue } from './in-process-queue';
import { BatchProcessor, type ExtractArchiveJobData } from './batch-processor';
import { ParseProcessor, type ParseResumeJobData } from './parse-processor';
import {
  ExtractionProcessor,
  type ExtractJobData,
} from './extraction-processor';
import { ScoringProcessor, type ScoringJobData } from './scoring-processor';

@Injectable()
export class DesktopQueueService {
  private readonly runner = new InProcessQueue(scoringConcurrency());

  constructor(private moduleRef: ModuleRef) {}

  enqueueArchive(data: ExtractArchiveJobData) {
    this.runner.add(() => this.moduleRef.get(BatchProcessor).process(data));
  }

  enqueueParse(data: ParseResumeJobData) {
    this.runner.add(() => this.moduleRef.get(ParseProcessor).process(data));
  }

  enqueueExtract(data: ExtractJobData) {
    this.runner.add(() =>
      this.moduleRef.get(ExtractionProcessor).process(data),
    );
  }

  enqueueScore(data: ScoringJobData) {
    this.runner.add(() => this.moduleRef.get(ScoringProcessor).process(data));
  }
}
