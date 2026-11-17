import { clampFitResult } from './parse-json';

const rationale = {
  strengths: ['Built APIs'],
  gaps: [],
  summary: 'Strong match.',
};

describe('clampFitResult', () => {
  it('keeps and rounds a top-level score', () => {
    expect(clampFitResult({ fitScore: 90.6, rationale }).fitScore).toBe(91);
  });

  it('accepts a numeric string', () => {
    expect(
      clampFitResult({ fitScore: '88' as unknown as number, rationale })
        .fitScore,
    ).toBe(88);
  });

  it('refuses a reply whose score sits inside the rationale instead of saving 0', () => {
    const nested = {
      rationale: { ...rationale, fitScore: 91 },
    } as unknown as Parameters<typeof clampFitResult>[0];
    expect(() => clampFitResult(nested)).toThrow('no score');
  });

  it('refuses an empty score', () => {
    expect(() =>
      clampFitResult({ fitScore: '' as unknown as number, rationale }),
    ).toThrow('no score');
  });
});
