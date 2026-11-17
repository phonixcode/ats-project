import { Injectable } from '@nestjs/common';
import { scoringConcurrency } from '../common/paths';
import { InProcessQueue } from './in-process-queue';
import { StageMetricsService } from '../diagnostics/stage-metrics.service';
import type {
  IngestBatchJobData,
  ExtractJobData,
  ParseResumeJobData,
  ScoringJobData,
} from './job-data';

type Handler<T> = (data: T) => Promise<void>;

const READER_CONCURRENCY = 4;

@Injectable()
export class DesktopQueueService {
  private readonly fileRunner = new InProcessQueue(scoringConcurrency());
  private readonly readerRunner = new InProcessQueue(READER_CONCURRENCY);
  private ingestHandler: Handler<IngestBatchJobData> | null = null;
  private parseHandler: Handler<ParseResumeJobData> | null = null;
  private extractHandler: Handler<ExtractJobData> | null = null;
  private scoreHandler: Handler<ScoringJobData> | null = null;

  constructor(private readonly stageMetrics: StageMetricsService) {}

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
    this.track(this.fileRunner, 'ingest', () =>
      this.require(this.ingestHandler, 'ingest')(data),
    );
  }

  enqueueParse(data: ParseResumeJobData) {
    this.track(this.fileRunner, 'parse', () =>
      this.require(this.parseHandler, 'parse')(data),
    );
  }

  enqueueExtract(data: ExtractJobData) {
    this.track(this.readerRunner, 'extract', () =>
      this.require(this.extractHandler, 'extract')(data),
    );
  }

  enqueueScore(data: ScoringJobData) {
    this.track(this.readerRunner, 'score', () =>
      this.require(this.scoreHandler, 'score')(data),
    );
  }

  private track(
    runner: InProcessQueue,
    stage: string,
    task: () => Promise<void>,
  ) {
    this.stageMetrics.queued(stage);
    runner.add(async () => {
      this.stageMetrics.started(stage);
      const start = performance.now();
      let ok = false;
      try {
        await task();
        ok = true;
      } finally {
        this.stageMetrics.finished(stage, performance.now() - start, ok);
      }
    });
  }

  private require<T>(handler: Handler<T> | null, name: string): Handler<T> {
    if (!handler) {
      throw new Error(`Scoring queue is not ready (${name}). Restart the app.`);
    }
    return handler;
  }
}
