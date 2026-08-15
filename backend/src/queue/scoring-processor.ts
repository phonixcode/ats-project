import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { EnsembleScoringService } from '../scores/ensemble-scoring.service';
import { BatchesService } from '../batches/batches.service';
import { DesktopQueueService } from './desktop-queue.service';
import type { ScoringJobData } from './job-data';

@Injectable()
export class ScoringProcessor implements OnModuleInit {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private ensembleScoring: EnsembleScoringService,
    private applicationsService: ApplicationsService,
    private batchesService: BatchesService,
    private jobs: DesktopQueueService,
  ) {}

  onModuleInit() {
    this.jobs.registerScore((data) => this.process(data));
  }

  async process(data: ScoringJobData) {
    const { applicationId, batchId } = data;

    await this.applicationsService.markScoring(applicationId);

    try {
      await this.ensembleScoring.scoreApplication(applicationId);
      await this.applicationsService.markScored(applicationId);
      if (batchId) {
        await this.batchesService.incrementProcessed(batchId);
        await this.batchesService.checkAndFinalize(batchId);
      }
    } catch (err) {
      this.logger.warn(
        `Scoring failed for application ${applicationId}: ${err.message}`,
      );
      await this.applicationsService.markScored(applicationId);
      if (batchId) {
        await this.batchesService.incrementProcessed(batchId);
        await this.batchesService.checkAndFinalize(batchId);
      }
    }
  }
}
