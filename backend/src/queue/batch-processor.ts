import { Injectable, Logger } from '@nestjs/common';
import { ArchiveExtractionService } from '../batches/archive-extraction.service';
import { BatchesService } from '../batches/batches.service';
import { CandidatesService } from '../candidates/candidates.service';
import { ApplicationsService } from '../applications/applications.service';
import { batchDir } from '../common/storage';
import { DesktopQueueService } from './desktop-queue.service';

export interface ExtractArchiveJobData {
  batchId: string;
  zipPath: string;
}

@Injectable()
export class BatchProcessor {
  private readonly logger = new Logger(BatchProcessor.name);

  constructor(
    private archiveExtraction: ArchiveExtractionService,
    private batchesService: BatchesService,
    private candidatesService: CandidatesService,
    private applicationsService: ApplicationsService,
    private jobs: DesktopQueueService,
  ) {}

  async process(data: ExtractArchiveJobData) {
    const { batchId, zipPath } = data;

    try {
      const batch = await this.batchesService.findOne(batchId);
      const destDir = batchDir(batchId);

      const files = await this.archiveExtraction.extractZip(zipPath, destDir);
      await this.batchesService.setTotalFiles(batchId, files.length);

      if (files.length === 0) {
        this.logger.warn(
          `No valid resume files found in archive for batch ${batchId}`,
        );
        await this.batchesService.checkAndFinalize(batchId);
        return;
      }

      for (const file of files) {
        const candidate = await this.candidatesService.findOrCreate({});
        const application = await this.applicationsService.create({
          candidateId: candidate.id,
          jobId: batch.jobId,
          batchId,
          rawFilePath: file.path,
        });
        this.jobs.enqueueParse({
          applicationId: application.id,
          candidateId: candidate.id,
          filePath: file.path,
          batchId,
        });
      }
    } catch (err) {
      this.logger.error(
        `Batch processing crashed for batch ${batchId}: ${err.message}`,
      );
      await this.batchesService.markFailed(batchId).catch(() => null);
    }
  }
}
