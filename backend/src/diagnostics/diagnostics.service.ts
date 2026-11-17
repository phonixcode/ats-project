import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { monitorEventLoopDelay } from 'perf_hooks';
import { PrismaService } from '../prisma/prisma.service';
import { StageMetricsService } from './stage-metrics.service';

const MB = 1024 * 1024;
const toMb = (bytes: number) => Math.round(bytes / MB);
const LOOP_RESOLUTION_MS = 20;
const loopDelayMs = (nanos: number) =>
  Math.max(0, Math.round(nanos / 1e6 - LOOP_RESOLUTION_MS));

@Injectable()
export class DiagnosticsService implements OnModuleDestroy {
  private readonly eventLoop = monitorEventLoopDelay({
    resolution: LOOP_RESOLUTION_MS,
  });
  private lastCpu = process.cpuUsage();
  private lastSampleAt = performance.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stages: StageMetricsService,
  ) {
    this.eventLoop.enable();
  }

  onModuleDestroy() {
    this.eventLoop.disable();
  }

  async snapshot() {
    const memory = process.memoryUsage();
    const now = performance.now();
    const cpu = process.cpuUsage(this.lastCpu);
    const elapsedMicros = (now - this.lastSampleAt) * 1000;
    this.lastCpu = process.cpuUsage();
    this.lastSampleAt = now;

    const eventLoop = {
      p50Ms: loopDelayMs(this.eventLoop.percentile(50)),
      p99Ms: loopDelayMs(this.eventLoop.percentile(99)),
      maxMs: loopDelayMs(this.eventLoop.max),
    };
    this.eventLoop.reset();

    const statuses = await this.prisma.application.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    return {
      at: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      memoryMb: {
        rss: toMb(memory.rss),
        heapUsed: toMb(memory.heapUsed),
        heapTotal: toMb(memory.heapTotal),
        external: toMb(memory.external),
        arrayBuffers: toMb(memory.arrayBuffers),
      },
      cpuPercent:
        elapsedMicros > 0
          ? Math.round(((cpu.user + cpu.system) / elapsedMicros) * 100)
          : 0,
      eventLoop,
      stages: this.stages.snapshot(),
      applications: Object.fromEntries(
        statuses.map((row) => [row.status, row._count._all]),
      ),
    };
  }
}
