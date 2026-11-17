import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { rename, rm } from 'fs/promises';
import { extname } from 'path';
import {
  ArchiveExtractionService,
  ExtractedFile,
} from '../batches/archive-extraction.service';
import { BatchesService } from '../batches/batches.service';
import { CandidatesService } from '../candidates/candidates.service';
import { ApplicationsService } from '../applications/applications.service';
import { batchDir, resumeFilePath } from '../common/storage';
import { DesktopQueueService } from './desktop-queue.service';
import type { IngestBatchJobData, UploadedResumeFile } from './job-data';

@Injectable()
export class BatchProcessor implements OnModuleInit {
  private readonly logger = new Logger(BatchProcessor.name);

  constructor(
    private archiveExtraction: ArchiveExtractionService,
    private batchesService: BatchesService,
    private candidatesService: CandidatesService,
    private applicationsService: ApplicationsService,
    private jobs: DesktopQueueService,
  ) {}

  onModuleInit() {
    this.jobs.registerIngest((data) => this.process(data));
  }

  async process(data: IngestBatchJobData) {
    const { batchId, uploads } = data;
    this.logger.log(
      `Batch ${batchId}: received ${uploads.length} upload(s): ${uploads
        .map((upload) => upload.originalName)
        .join(', ')}`,
    );

    try {
      const batch = await this.batchesService.findOne(batchId);
      const destDir = batchDir(batchId);

      const files: ExtractedFile[] = [];
      for (const upload of uploads) {
        files.push(...(await this.collectResumes(upload, destDir)));
      }
      await this.batchesService.setTotalFiles(batchId, files.length);

      if (files.length === 0) {
        this.logger.warn(`Batch ${batchId}: no readable resume files found`);
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
      this.logger.log(`Batch ${batchId}: queued ${files.length} resume(s)`);
    } catch (err) {
      this.logger.error(
        `Batch processing crashed for batch ${batchId}: ${err.message}`,
        err.stack,
      );
      await this.batchesService.markFailed(batchId).catch(() => null);
    }
  }

  private async collectResumes(
    upload: UploadedResumeFile,
    destDir: string,
  ): Promise<ExtractedFile[]> {
    try {
      if (extname(upload.originalName).toLowerCase() === '.zip') {
        const extracted = await this.archiveExtraction.extractZip(
          upload.path,
          destDir,
        );
        await rm(upload.path, { force: true });
        return extracted;
      }
      const target = resumeFilePath(destDir, upload.originalName);
      await rename(upload.path, target);
      return [{ originalName: upload.originalName, path: target }];
    } catch (err) {
      this.logger.error(
        `Could not open ${upload.originalName}: ${err.message}`,
        err.stack,
      );
      return [];
    }
  }
}
