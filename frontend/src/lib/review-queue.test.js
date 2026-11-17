import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPage, compareByScore, readerNote, summarizeQueue } from './review-queue.js';

function app(overrides) {
  return {
    id: overrides.id ?? '1',
    failureReason: null,
    score: { fitScore: 80, bucket: 'STRONG_FIT' },
    candidate: { name: 'Ada', email: 'ada@example.com', phone: null },
    reviews: [],
    ...overrides,
  };
}

describe('summarizeQueue', () => {
  it('counts each pile in one pass', () => {
    const counts = summarizeQueue([
      app({ id: 'a', reviews: [] }),
      app({ id: 'f', reviews: [], score: { fitScore: 60, bucket: 'NEEDS_REVIEW' } }),
      app({ id: 'b', reviews: [{ humanDecision: 'SHORTLIST' }] }),
      app({ id: 'c', reviews: [{ humanDecision: 'REJECT' }] }),
      app({ id: 'd', score: null }),
      app({ id: 'e', failureReason: 'unreadable', score: null }),
    ]);
    assert.deepEqual(counts, {
      toReview: 2,
      shortlisted: 1,
      maybe: 0,
      passed: 1,
      unread: 1,
      strongFits: 1,
      closerLook: 1,
      scoring: 1,
      total: 6,
    });
  });
});

describe('compareByScore', () => {
  it('orders higher scores first, then name', () => {
    const rows = [
      app({ id: '1', candidate: { name: 'Zed' }, score: { fitScore: 70 } }),
      app({ id: '2', candidate: { name: 'Ann' }, score: { fitScore: 90 } }),
      app({ id: '3', candidate: { name: 'Bea' }, score: { fitScore: 90 } }),
    ];
    rows.sort(compareByScore);
    assert.deepEqual(rows.map((row) => row.candidate.name), ['Ann', 'Bea', 'Zed']);
  });
});

describe('buildReviewPage', () => {
  const pile = Array.from({ length: 45 }, (_, index) =>
    app({
      id: String(index),
      candidate: { name: `Person ${String(index).padStart(2, '0')}`, email: `p${index}@x.com` },
      score: { fitScore: 100 - index, bucket: 'STRONG_FIT' },
    }),
  );

  it('pages twenty at a time and keeps next-up on the first to-review page', () => {
    const first = buildReviewPage(pile, { view: 'to_review', query: '', page: 1, pageSize: 20 });
    assert.equal(first.total, 45);
    assert.equal(first.pageCount, 3);
    assert.equal(first.items.length, 20);
    assert.equal(first.start, 1);
    assert.equal(first.end, 20);
    assert.equal(first.nextUp.id, '0');
    assert.equal(first.items[0].id, '0');

    const last = buildReviewPage(pile, { view: 'to_review', query: '', page: 3, pageSize: 20 });
    assert.equal(last.items.length, 5);
    assert.equal(last.nextUp, null);
    assert.equal(last.start, 41);
    assert.equal(last.end, 45);
  });

  it('clamps an out-of-range page and searches without scanning the whole render set', () => {
    const page = buildReviewPage(pile, { view: 'all', query: 'Person 07', page: 99, pageSize: 20 });
    assert.equal(page.page, 1);
    assert.equal(page.total, 1);
    assert.equal(page.items[0].candidate.name, 'Person 07');
    assert.equal(page.nextUp, null);
  });

  it('keeps shortlist view to people you already chose', () => {
    const page = buildReviewPage(
      [
        app({ id: 'keep', reviews: [{ humanDecision: 'SHORTLIST' }], candidate: { name: 'Qudus' } }),
        app({ id: 'skip', reviews: [] }),
      ],
      { view: 'shortlisted', query: '', page: 1 },
    );
    assert.equal(page.total, 1);
    assert.equal(page.items[0].id, 'keep');
  });
});

describe('readerNote', () => {
  it('gives the first sentence of the verdict and the first thing to check', () => {
    const note = readerNote(
      app({
        score: {
          fitScore: 82,
          bucket: 'STRONG_FIT',
          fitRationaleJson: {
            summary: 'Strong match for Compliance Officer. Confirm notice period.',
            gaps: ['Based in Kano; the role is listed in Lagos — confirm location or relocation.'],
          },
        },
      }),
    );
    assert.equal(note.verdict, 'Strong match for Compliance Officer.');
    assert.match(note.toCheck, /Kano/);
  });

  it('returns null before the read is done', () => {
    assert.equal(readerNote(app({ score: null })), null);
  });
});

describe('good and possible match views', () => {
  it('only lists undecided candidates in each bucket', () => {
    const apps = [
      app({ id: 's', score: { fitScore: 85, bucket: 'STRONG_FIT' } }),
      app({ id: 'd', score: { fitScore: 90, bucket: 'STRONG_FIT' }, reviews: [{ humanDecision: 'SHORTLIST' }] }),
      app({ id: 'n', score: { fitScore: 60, bucket: 'NEEDS_REVIEW' } }),
    ];
    assert.deepEqual(buildReviewPage(apps, { view: 'good_matches' }).items.map((a) => a.id), ['s']);
    assert.deepEqual(buildReviewPage(apps, { view: 'possible_matches' }).items.map((a) => a.id), ['n']);
  });
});
