import { Bucket } from '@prisma/client';
import { planShortlist, type ShortlistCandidate } from './shortlist-plan';

const person = (
  id: string,
  score: number,
  bucket: Bucket = Bucket.STRONG_FIT,
): ShortlistCandidate => ({
  id,
  name: id,
  email: null,
  score,
  bucket,
  worthAsking: null,
});

describe('planShortlist', () => {
  it('picks the highest-scoring good matches up to the limit', () => {
    const plan = planShortlist(
      [person('b', 80), person('a', 92), person('c', 75)],
      0,
      2,
    );
    expect(plan.picks.map((p) => p.id)).toEqual(['a', 'b']);
    expect(plan.secondLook.map((p) => p.id)).toEqual(['c']);
    expect(plan.secondLook[0].reason).toContain('just outside your 2');
  });

  it('counts people already shortlisted towards the limit', () => {
    const plan = planShortlist([person('a', 90), person('b', 85)], 2, 3);
    expect(plan.picks.map((p) => p.id)).toEqual(['a']);
  });

  it('never auto-picks possible matches but surfaces close calls for a second look', () => {
    const plan = planShortlist(
      [
        person('good', 88),
        person('close', 64, Bucket.NEEDS_REVIEW),
        person('thin', 40, Bucket.NEEDS_REVIEW),
        person('missing', 70, Bucket.HARD_FILTERED),
      ],
      0,
      5,
    );
    expect(plan.picks.map((p) => p.id)).toEqual(['good']);
    expect(plan.secondLook.map((p) => p.id)).toEqual(['close']);
  });

  it('caps the second-look list', () => {
    const many = Array.from({ length: 20 }, (_, i) => person(`p${i}`, 99 - i));
    expect(planShortlist(many, 0, 1).secondLook).toHaveLength(8);
  });
});
