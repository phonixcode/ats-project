import { withRetry, withTimeout } from './with-retry';

describe('withTimeout', () => {
  it('rejects when the work takes too long', async () => {
    await expect(withTimeout(new Promise(() => undefined), 20)).rejects.toThrow(
      'This is taking longer than expected',
    );
  });
});

describe('withRetry', () => {
  it('retries once after a failure then succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('temporary');
        return 'ok';
      },
      { retries: 1, timeoutMs: 1000 },
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws after retries are exhausted', async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error('still down');
        },
        { retries: 1, timeoutMs: 1000 },
      ),
    ).rejects.toThrow('still down');
  });
});
