import { clampScore, median, mergeJudgeOpinions } from './ensemble';
import type { JudgeOpinion } from './ensemble';

function opinion(
  provider: JudgeOpinion['provider'],
  overrides: Partial<JudgeOpinion> = {},
): JudgeOpinion {
  return {
    provider,
    model: `${provider}-test`,
    fitScore: 80,
    rationale: {
      strengths: [`${provider} strength`],
      gaps: [],
      summary: `${provider} summary`,
    },
    requirementChecks: [
      { requirement: '3 years backend', kind: 'must_have', status: 'met' },
    ],
    authenticitySignal: 'NATURAL',
    authenticityReasoning: 'Specific projects',
    ...overrides,
  };
}

describe('clampScore', () => {
  it('keeps scores inside 0–100', () => {
    expect(clampScore(-4)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(72.4)).toBe(72);
  });
});

describe('median', () => {
  it('returns the middle value of three scores', () => {
    expect(median([40, 90, 70])).toBe(70);
  });

  it('averages the two middle values for an even set', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe('mergeJudgeOpinions', () => {
  it('returns null when every judge failed', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { error: 'timeout', fitScore: undefined }),
      opinion('claude', { error: 'timeout', fitScore: undefined }),
      opinion('gemini', { error: 'timeout', fitScore: undefined }),
    ]);
    expect(result).toBeNull();
  });

  it('uses the median score of successful judges', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { fitScore: 90 }),
      opinion('claude', { fitScore: 40 }),
      opinion('gemini', { fitScore: 70 }),
    ]);
    expect(result?.fitScore).toBe(70);
    expect(result?.bucket).toBe('STRONG_FIT');
    expect(result?.successfulCount).toBe(3);
  });

  it('still produces consensus from a single successful judge', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { error: 'timeout', fitScore: undefined }),
      opinion('claude', { fitScore: 81 }),
      opinion('gemini', { error: 'not configured', fitScore: undefined }),
    ]);
    expect(result?.fitScore).toBe(81);
    expect(result?.successfulCount).toBe(1);
    expect(result?.disagreement).toBe(false);
  });

  it('flags disagreement when scores spread more than 15 points', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { fitScore: 90 }),
      opinion('claude', { fitScore: 50 }),
      opinion('gemini', { fitScore: 88 }),
    ]);
    expect(result?.disagreement).toBe(true);
  });

  it('does not flag disagreement when scores are close', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { fitScore: 78 }),
      opinion('claude', { fitScore: 72 }),
      opinion('gemini', { fitScore: 75 }),
    ]);
    expect(result?.disagreement).toBe(false);
  });

  it('hard-filters when any successful judge marks a must-have missing', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { fitScore: 88 }),
      opinion('claude', {
        fitScore: 85,
        requirementChecks: [
          {
            requirement: 'AWS certification',
            kind: 'must_have',
            status: 'missing',
          },
        ],
      }),
      opinion('gemini', { fitScore: 90 }),
    ]);
    expect(result?.bucket).toBe('HARD_FILTERED');
  });

  it('uses majority authenticity and UNCERTAIN on a split', () => {
    const majority = mergeJudgeOpinions([
      opinion('openai', { authenticitySignal: 'TEMPLATED' }),
      opinion('claude', { authenticitySignal: 'TEMPLATED' }),
      opinion('gemini', { authenticitySignal: 'NATURAL' }),
    ]);
    expect(majority?.authenticitySignal).toBe('TEMPLATED');

    const split = mergeJudgeOpinions([
      opinion('openai', { authenticitySignal: 'NATURAL' }),
      opinion('claude', { authenticitySignal: 'TEMPLATED' }),
      opinion('gemini', { authenticitySignal: 'UNCERTAIN' }),
    ]);
    expect(split?.authenticitySignal).toBe('UNCERTAIN');
  });

  it('ignores failed judges when computing median and bucket', () => {
    const result = mergeJudgeOpinions([
      opinion('openai', { fitScore: 42 }),
      opinion('claude', {
        error: 'Claude didn’t return a read',
        fitScore: undefined,
      }),
      opinion('gemini', { fitScore: 44 }),
    ]);
    expect(result?.fitScore).toBe(43);
    expect(result?.bucket).toBe('NEEDS_REVIEW');
    expect(result?.successfulCount).toBe(2);
  });
});
