export function parseJsonObject<T>(raw: string, context: string): T {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced) as T;
  } catch {
    throw new Error(`${context}: model returned invalid JSON`);
  }
}

export function clampFitResult(result: {
  fitScore: number;
  rationale: { strengths: string[]; gaps: string[]; summary: string };
  requirementChecks?: unknown;
}) {
  const score =
    typeof result.fitScore === 'number' ||
    (typeof result.fitScore === 'string' && /\d/.test(result.fitScore))
      ? Number(result.fitScore)
      : NaN;
  if (!Number.isFinite(score)) {
    throw new Error('the reader’s reply had no score');
  }
  return {
    fitScore: Math.min(100, Math.max(0, Math.round(score))),
    rationale: {
      strengths: result.rationale?.strengths ?? [],
      gaps: result.rationale?.gaps ?? [],
      summary: result.rationale?.summary ?? '',
    },
    requirementChecks: Array.isArray(result.requirementChecks)
      ? result.requirementChecks
      : [],
  };
}
