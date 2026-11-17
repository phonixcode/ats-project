import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { attentionLine, displayName, greeting, matchLabel } from './format.js';

describe('displayName', () => {
  it('turns an all-caps name from a resume into normal case', () => {
    assert.equal(displayName('MATIN ADEBAYO'), 'Matin Adebayo');
    assert.equal(displayName("O'NEIL ADE-BELLO"), "O'Neil Ade-Bello");
  });

  it('leaves names that already have mixed case alone', () => {
    assert.equal(displayName('Qudus McKay'), 'Qudus McKay');
  });

  it('falls back when there is no name', () => {
    assert.equal(displayName(''), 'Unnamed candidate');
    assert.equal(displayName(null), 'Unnamed candidate');
  });
});

describe('greeting and attentionLine', () => {
  it('greets by time of day', () => {
    assert.equal(greeting(new Date(2026, 0, 1, 9)), 'Good morning');
    assert.equal(greeting(new Date(2026, 0, 1, 14)), 'Good afternoon');
    assert.equal(greeting(new Date(2026, 0, 1, 20)), 'Good evening');
  });

  it('says plainly who is waiting', () => {
    assert.equal(
      attentionLine([{ title: 'Software Engineer', unreviewedCount: 2 }]),
      '2 people are waiting for your decision in Software Engineer.',
    );
    assert.match(attentionLine([{ title: 'A', unreviewedCount: 0 }]), /all caught up/);
  });
});

describe('matchLabel', () => {
  it('describes fit in four plain tiers', () => {
    assert.equal(matchLabel({ bucket: 'STRONG_FIT', fitScore: 94 }), 'Strong match');
    assert.equal(matchLabel({ bucket: 'STRONG_FIT', fitScore: 72 }), 'Good match');
    assert.equal(matchLabel({ bucket: 'NEEDS_REVIEW', fitScore: 60 }), 'Possible match');
    assert.equal(matchLabel({ bucket: 'HARD_FILTERED', fitScore: 80 }), 'Unlikely match');
    assert.equal(matchLabel(null), null);
  });
});
