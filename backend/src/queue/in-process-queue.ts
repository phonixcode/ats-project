export type QueueTask = () => Promise<void>;

export class InProcessQueue {
  private readonly pending: QueueTask[] = [];
  private running = 0;

  constructor(private readonly concurrency: number) {
    if (concurrency < 1) throw new Error('concurrency must be at least 1');
  }

  get size(): number {
    return this.pending.length + this.running;
  }

  add(task: QueueTask): void {
    this.pending.push(task);
    this.pump();
  }

  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) return;
      this.running += 1;
      void task()
        .catch(() => undefined)
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }
}
