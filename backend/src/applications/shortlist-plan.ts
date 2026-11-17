import { Bucket } from '@prisma/client';

export const SECOND_LOOK_MIN_SCORE = 60;
export const SECOND_LOOK_LIMIT = 8;

export interface ShortlistCandidate {
  id: string;
  name: string | null;
  email: string | null;
  score: number;
  bucket: Bucket;
  worthAsking: string | null;
}

export interface SecondLookCandidate extends ShortlistCandidate {
  reason: string;
}

export interface ShortlistPlan {
  limit: number;
  alreadyShortlisted: number;
  picks: ShortlistCandidate[];
  secondLook: SecondLookCandidate[];
}

export function planShortlist(
  undecided: ShortlistCandidate[],
  alreadyShortlisted: number,
  limit: number,
): ShortlistPlan {
  const byScore = [...undecided].sort((a, b) => b.score - a.score);
  const goodMatches = byScore.filter((c) => c.bucket === Bucket.STRONG_FIT);
  const openSlots = Math.max(0, limit - alreadyShortlisted);
  const picks = goodMatches.slice(0, openSlots);

  const justOutside = goodMatches.slice(openSlots).map((candidate) => ({
    ...candidate,
    reason: `Good match just outside your ${limit}.`,
  }));
  const closeCalls = byScore
    .filter(
      (c) =>
        c.bucket === Bucket.NEEDS_REVIEW && c.score >= SECOND_LOOK_MIN_SCORE,
    )
    .map((candidate) => ({
      ...candidate,
      reason:
        'No must-have missing — the resume leaves a few things to confirm.',
    }));

  const secondLook = [...justOutside, ...closeCalls]
    .sort((a, b) => b.score - a.score)
    .slice(0, SECOND_LOOK_LIMIT);

  return { limit, alreadyShortlisted, picks, secondLook };
}
