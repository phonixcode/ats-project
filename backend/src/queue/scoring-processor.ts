import { Injectable, Logger } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { EnsembleScoringService } from '../scores/ensemble-scoring.service';
import { BatchesService } from '../batches/batches.service';

export interface ScoringJobData {
  applicationId: string;
  batchId?: string;
}

@Injectable()
export class ScoringProcessor {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private ensembleScoring: EnsembleScoringService,
    private applicationsService: ApplicationsService,
    private batchesService: BatchesService,
  ) {}

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
