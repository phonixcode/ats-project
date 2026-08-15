import { Injectable, Logger } from '@nestjs/common';
import { ResumeParserService } from '../applications/resume-parser.service';
import { ApplicationsService } from '../applications/applications.service';
import { BatchesService } from '../batches/batches.service';
import { DesktopQueueService } from './desktop-queue.service';

export interface ParseResumeJobData {
  applicationId: string;
  candidateId: string;
  filePath: string;
  batchId?: string;
}

@Injectable()
export class ParseProcessor {
  private readonly logger = new Logger(ParseProcessor.name);

  constructor(
    private resumeParser: ResumeParserService,
    private applicationsService: ApplicationsService,
    private batchesService: BatchesService,
    private jobs: DesktopQueueService,
  ) {}

  async process(data: ParseResumeJobData) {
    const { applicationId, candidateId, filePath, batchId } = data;

    await this.applicationsService.markParsing(applicationId);

    try {
      const text = await this.resumeParser.parse(filePath);
      await this.applicationsService.markParsed(applicationId, text);
      this.jobs.enqueueExtract({
        applicationId,
        candidateId,
        resumeText: text,
        batchId,
      });
    } catch (err) {
      this.logger.warn(
        `Parse failed for application ${applicationId}: ${err.message}`,
      );
      await this.applicationsService.markFailed(
        applicationId,
        "We couldn't read this resume. Check the file and try again.",
      );
      if (batchId) {
        await this.batchesService.incrementProcessed(batchId, true);
        await this.batchesService.checkAndFinalize(batchId);
      }
    }
  }
}
