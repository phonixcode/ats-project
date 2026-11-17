import { Injectable } from '@nestjs/common';
import { scoringConcurrency } from '../common/paths';
import { InProcessQueue } from './in-process-queue';
import type {
  IngestBatchJobData,
  ExtractJobData,
  ParseResumeJobData,
  ScoringJobData,
} from './job-data';

type Handler<T> = (data: T) => Promise<void>;

@Injectable()
export class DesktopQueueService {
  private readonly runner = new InProcessQueue(scoringConcurrency());
  private ingestHandler: Handler<IngestBatchJobData> | null = null;
  private parseHandler: Handler<ParseResumeJobData> | null = null;
  private extractHandler: Handler<ExtractJobData> | null = null;
  private scoreHandler: Handler<ScoringJobData> | null = null;

  registerIngest(handler: Handler<IngestBatchJobData>) {
    this.ingestHandler = handler;
  }

  registerParse(handler: Handler<ParseResumeJobData>) {
    this.parseHandler = handler;
  }

  registerExtract(handler: Handler<ExtractJobData>) {
    this.extractHandler = handler;
  }

  registerScore(handler: Handler<ScoringJobData>) {
    this.scoreHandler = handler;
  }

  enqueueIngest(data: IngestBatchJobData) {
    this.runner.add(() => this.require(this.ingestHandler, 'ingest')(data));
  }

  enqueueParse(data: ParseResumeJobData) {
    this.runner.add(() => this.require(this.parseHandler, 'parse')(data));
  }

  enqueueExtract(data: ExtractJobData) {
    this.runner.add(() => this.require(this.extractHandler, 'extract')(data));
  }

  enqueueScore(data: ScoringJobData) {
    this.runner.add(() => this.require(this.scoreHandler, 'score')(data));
  }

  private require<T>(handler: Handler<T> | null, name: string): Handler<T> {
    if (!handler) {
      throw new Error(`Scoring queue is not ready (${name}). Restart the app.`);
    }
    return handler;
  }
}
