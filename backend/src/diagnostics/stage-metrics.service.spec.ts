import { StageMetricsService } from './stage-metrics.service';

describe('StageMetricsService', () => {
  it('tracks waiting, running and finished work per stage', () => {
    const metrics = new StageMetricsService();
    metrics.queued('parse');
    metrics.queued('parse');
    metrics.started('parse');
    expect(metrics.snapshot().parse).toMatchObject({ waiting: 1, running: 1 });

    metrics.finished('parse', 120, true);
    metrics.started('parse');
    metrics.finished('parse', 80, false);
    expect(metrics.snapshot().parse).toMatchObject({
      waiting: 0,
      running: 0,
      done: 1,
      failed: 1,
      avgMs: 100,
      maxMs: 120,
    });
  });

  it('times async work and records failures without swallowing them', async () => {
    const metrics = new StageMetricsService();
    await metrics.time('reader:openai', () => Promise.resolve('ok'));
    await expect(
      metrics.time('reader:openai', () => Promise.reject(new Error('401'))),
    ).rejects.toThrow('401');
    expect(metrics.snapshot()['reader:openai']).toMatchObject({
      done: 1,
      failed: 1,
    });
  });
});
