export type ProviderName =
  'openai' | 'claude' | 'gemini' | 'local' | 'heuristic';
export type RequirementKind = 'must_have' | 'nice_to_have';
export type RequirementStatus = 'met' | 'partial' | 'missing';
export type AuthenticitySignal = 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN';
export type Bucket = 'STRONG_FIT' | 'NEEDS_REVIEW' | 'HARD_FILTERED';

export interface RequirementCheck {
  requirement: string;
  kind: RequirementKind;
  status: RequirementStatus;
}

export interface FitRationale {
  strengths: string[];
  gaps: string[];
  summary: string;
}

export interface JudgeOpinion {
  provider: ProviderName;
  model: string;
  fitScore?: number;
  rationale?: FitRationale;
  requirementChecks?: RequirementCheck[];
  authenticitySignal?: AuthenticitySignal;
  authenticityReasoning?: string;
  error?: string;
}

export interface ConsensusResult {
  fitScore: number;
  rationale: FitRationale;
  authenticitySignal: AuthenticitySignal;
  authenticityReasoning: string;
  bucket: Bucket;
  disagreement: boolean;
  requirementChecks: RequirementCheck[];
  successfulCount: number;
}

export const STRONG_FIT_THRESHOLD = 70;
export const DISAGREEMENT_THRESHOLD = 15;

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot compute median of an empty list');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function isSuccessful(opinion: JudgeOpinion): boolean {
  return opinion.error == null && typeof opinion.fitScore === 'number';
}

function determineBucket(fitScore: number, checks: RequirementCheck[]): Bucket {
  const missingMustHave = checks.some(
    (check) => check.kind === 'must_have' && check.status === 'missing',
  );
  if (missingMustHave) return 'HARD_FILTERED';
  if (fitScore >= STRONG_FIT_THRESHOLD) return 'STRONG_FIT';
  return 'NEEDS_REVIEW';
}

function mergeRequirementChecks(opinions: JudgeOpinion[]): RequirementCheck[] {
  const byRequirement = new Map<string, RequirementCheck>();
  for (const opinion of opinions) {
    for (const check of opinion.requirementChecks ?? []) {
      const key = `${check.kind}:${check.requirement}`;
      const existing = byRequirement.get(key);
      if (!existing) {
        byRequirement.set(key, { ...check });
        continue;
      }
      if (check.status === 'missing' || existing.status === 'missing') {
        existing.status = 'missing';
      } else if (check.status === 'partial' || existing.status === 'partial') {
        existing.status = 'partial';
      } else {
        existing.status = 'met';
      }
    }
  }
  return [...byRequirement.values()];
}

function majorityAuthenticity(opinions: JudgeOpinion[]): {
  signal: AuthenticitySignal;
  reasoning: string;
} {
  const counts: Record<AuthenticitySignal, number> = {
    NATURAL: 0,
    TEMPLATED: 0,
    UNCERTAIN: 0,
  };
  const reasons: Record<AuthenticitySignal, string[]> = {
    NATURAL: [],
    TEMPLATED: [],
    UNCERTAIN: [],
  };
  for (const opinion of opinions) {
    if (!opinion.authenticitySignal) continue;
    counts[opinion.authenticitySignal] += 1;
    if (opinion.authenticityReasoning) {
      reasons[opinion.authenticitySignal].push(opinion.authenticityReasoning);
    }
  }
  const ranked = (
    Object.entries(counts) as [AuthenticitySignal, number][]
  ).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const signal = top[1] === 0 || top[1] === second[1] ? 'UNCERTAIN' : top[0];
  return {
    signal,
    reasoning: reasons[signal][0] ?? 'Judges did not agree on how this reads.',
  };
}

function pickMedianRationale(
  opinions: JudgeOpinion[],
  scores: number[],
): FitRationale {
  const target = median(scores);
  const closest =
    opinions.find((o) => clampScore(o.fitScore!) === Math.round(target)) ??
    opinions[0];
  return (
    closest.rationale ?? {
      strengths: [],
      gaps: [],
      summary: '',
    }
  );
}

export function mergeJudgeOpinions(
  opinions: JudgeOpinion[],
): ConsensusResult | null {
  const successful = opinions.filter(isSuccessful);
  if (successful.length === 0) return null;

  const scores = successful.map((o) => clampScore(o.fitScore!));
  const fitScore = median(scores);
  const disagreement =
    scores.length >= 2 &&
    Math.max(...scores) - Math.min(...scores) > DISAGREEMENT_THRESHOLD;
  const requirementChecks = mergeRequirementChecks(successful);
  const authenticity = majorityAuthenticity(successful);

  return {
    fitScore,
    rationale: pickMedianRationale(successful, scores),
    authenticitySignal: authenticity.signal,
    authenticityReasoning: authenticity.reasoning,
    bucket: determineBucket(fitScore, requirementChecks),
    disagreement,
    requirementChecks,
    successfulCount: successful.length,
  };
}
