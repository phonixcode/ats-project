import { Injectable } from '@nestjs/common';

const SAMPLES_KEPT = 500;

interface StageCounters {
  waiting: number;
  running: number;
  done: number;
  failed: number;
  durations: number[];
}

export interface StageSummary {
  waiting: number;
  running: number;
  done: number;
  failed: number;
  avgMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

@Injectable()
export class StageMetricsService {
  private readonly stages = new Map<string, StageCounters>();

  queued(stage: string): void {
    this.counters(stage).waiting += 1;
  }

  started(stage: string): void {
    const counters = this.counters(stage);
    counters.waiting = Math.max(0, counters.waiting - 1);
    counters.running += 1;
  }

  finished(stage: string, ms: number, ok: boolean): void {
    const counters = this.counters(stage);
    counters.running = Math.max(0, counters.running - 1);
    this.record(stage, ms, ok);
  }

  record(stage: string, ms: number, ok: boolean): void {
    const counters = this.counters(stage);
    if (ok) counters.done += 1;
    else counters.failed += 1;
    counters.durations.push(ms);
    if (counters.durations.length > SAMPLES_KEPT) counters.durations.shift();
  }

  async time<T>(stage: string, work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await work();
      this.record(stage, performance.now() - start, true);
      return result;
    } catch (error) {
      this.record(stage, performance.now() - start, false);
      throw error;
    }
  }

  snapshot(): Record<string, StageSummary> {
    const summary: Record<string, StageSummary> = {};
    for (const [stage, counters] of this.stages) {
      const sorted = [...counters.durations].sort((a, b) => a - b);
      const total = sorted.reduce((sum, ms) => sum + ms, 0);
      summary[stage] = {
        waiting: counters.waiting,
        running: counters.running,
        done: counters.done,
        failed: counters.failed,
        avgMs: sorted.length ? Math.round(total / sorted.length) : null,
        p95Ms: sorted.length
          ? Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)])
          : null,
        maxMs: sorted.length ? Math.round(sorted[sorted.length - 1]) : null,
      };
    }
    return summary;
  }

  private counters(stage: string): StageCounters {
    let counters = this.stages.get(stage);
    if (!counters) {
      counters = { waiting: 0, running: 0, done: 0, failed: 0, durations: [] };
      this.stages.set(stage, counters);
    }
    return counters;
  }
}
