import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPage, compareByScore, summarizeQueue } from './review-queue.js';

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
      app({ id: 'b', reviews: [{ humanDecision: 'SHORTLIST' }] }),
      app({ id: 'c', reviews: [{ humanDecision: 'REJECT' }] }),
      app({ id: 'd', score: null }),
      app({ id: 'e', failureReason: 'unreadable', score: null }),
    ]);
    assert.deepEqual(counts, {
      toReview: 1,
      shortlisted: 1,
      maybe: 0,
      passed: 1,
      unread: 1,
      scoring: 1,
      total: 5,
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
