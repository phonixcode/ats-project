import { InProcessQueue } from './in-process-queue';

describe('InProcessQueue', () => {
  it('runs one task at a time when concurrency is 1', async () => {
    const seen: number[] = [];
    const queue = new InProcessQueue(1);
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    queue.add(async () => {
      seen.push(1);
      await firstGate;
    });
    queue.add(async () => {
      seen.push(2);
    });

    await Promise.resolve();
    expect(seen).toEqual([1]);
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toEqual([1, 2]);
  });

  it('keeps draining after a failed task', async () => {
    const seen: string[] = [];
    const queue = new InProcessQueue(1);
    queue.add(async () => {
      seen.push('a');
      throw new Error('boom');
    });
    queue.add(async () => {
      seen.push('b');
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(seen).toEqual(['a', 'b']);
  });
});
