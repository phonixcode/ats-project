import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { ProviderRegistryService } from '../llm/provider-registry.service';
import { ApplicationsService } from '../applications/applications.service';
import { CandidatesService } from '../candidates/candidates.service';
import { BatchesService } from '../batches/batches.service';
import { DesktopQueueService } from './desktop-queue.service';
import type { ExtractJobData } from './job-data';

@Injectable()
export class ExtractionProcessor implements OnModuleInit {
  private readonly logger = new Logger(ExtractionProcessor.name);

  constructor(
    private registry: ProviderRegistryService,
    private applicationsService: ApplicationsService,
    private candidatesService: CandidatesService,
    private batchesService: BatchesService,
    private jobs: DesktopQueueService,
  ) {}

  onModuleInit() {
    this.jobs.registerExtract((data) => this.process(data));
  }

  async process(data: ExtractJobData) {
    const { applicationId, candidateId, resumeText, batchId } = data;

    await this.applicationsService.markExtracting(applicationId);

    try {
      const extracted = await this.registry.extractWithFallback(resumeText);
      await this.applicationsService.markExtracted(applicationId, extracted);

      if (extracted.email || extracted.name) {
        await this.candidatesService.updateIdentity(candidateId, {
          name: extracted.name ?? undefined,
          email: extracted.email ?? undefined,
          phone: extracted.phone ?? undefined,
        });
      }

      this.jobs.enqueueScore({
        applicationId,
        batchId,
      });
    } catch (err) {
      this.logger.warn(
        `Extraction failed for application ${applicationId}: ${err.message}`,
      );
      await this.applicationsService.markFailed(
        applicationId,
        "We couldn't read this resume. Check the file and try again.",
        ApplicationStatus.EXTRACT_FAILED,
      );
      if (batchId) {
        await this.batchesService.incrementProcessed(batchId, true);
        await this.batchesService.checkAndFinalize(batchId);
      }
    }
  }
}
