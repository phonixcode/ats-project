import {
  assessAuthenticityLocally,
  evaluateFitLocally,
  extractResumeLocally,
  generateQuestionsLocally,
} from './local-evaluator';

describe('extractResumeLocally', () => {
  it('pulls name, email, and phone from resume text', () => {
    const extracted = extractResumeLocally(
      'Qudus Oyetola\nSoftware Engineer\nqudus@example.com\n+234 801 234 5678\nSkills: Node.js, React, Postgres',
    );
    expect(extracted.email).toBe('qudus@example.com');
    expect(extracted.phone).toContain('234');
    expect(extracted.name).toBe('Qudus Oyetola');
    expect(extracted.skills).toEqual(
      expect.arrayContaining(['Node.js', 'React', 'Postgres']),
    );
  });
});

describe('evaluateFitLocally', () => {
  it('scores higher when skills and years match the posting', () => {
    const strong = evaluateFitLocally(
      {
        name: 'Ada',
        email: null,
        phone: null,
        skills: ['Node.js', 'Postgres', 'AWS'],
        yearsOfExperience: 6,
        education: [],
        employmentGaps: [],
        summary: 'Backend engineer with Node.js and Postgres in production.',
      },
      {
        title: 'Backend Engineer',
        description: 'We need Node.js, Postgres, and AWS. 5+ years.',
        mustHaves: ['Node.js', 'Postgres'],
        niceToHaves: ['AWS'],
        skills: ['Node.js', 'Postgres', 'AWS'],
        minYears: 5,
      },
    );
    const weak = evaluateFitLocally(
      {
        name: 'Bea',
        email: null,
        phone: null,
        skills: ['Excel'],
        yearsOfExperience: 1,
        education: [],
        employmentGaps: [],
        summary: 'Recent graduate.',
      },
      {
        title: 'Backend Engineer',
        description: 'We need Node.js, Postgres, and AWS. 5+ years.',
        mustHaves: ['Node.js', 'Postgres'],
        niceToHaves: ['AWS'],
        skills: ['Node.js', 'Postgres', 'AWS'],
        minYears: 5,
      },
    );
    expect(strong.fitScore).toBeGreaterThan(weak.fitScore);
    expect(strong.fitScore).toBeGreaterThanOrEqual(70);
    expect(
      weak.requirementChecks.some(
        (check) => check.kind === 'must_have' && check.status === 'missing',
      ),
    ).toBe(true);
  });
});

describe('assessAuthenticityLocally', () => {
  it('flags buzzword-only text as templated', () => {
    const result = assessAuthenticityLocally(
      'Synergistic results-driven professional leveraging cutting-edge paradigms to deliver world-class solutions and passionate thought leadership.',
    );
    expect(result.signal).toBe('TEMPLATED');
  });

  it('treats specific writing as natural', () => {
    const result = assessAuthenticityLocally(
      'I rebuilt the billing worker after a 3am outage. The queue had silently dropped invoices for eight days.',
    );
    expect(result.signal).toBe('NATURAL');
  });
});

describe('generateQuestionsLocally', () => {
  it('returns four grounded questions', () => {
    const questions = generateQuestionsLocally(
      {
        name: 'Ada',
        email: null,
        phone: null,
        skills: ['Node.js'],
        yearsOfExperience: 5,
        education: [],
        employmentGaps: [],
        summary: 'Built payment APIs.',
      },
      {
        strengths: ['Node.js APIs'],
        gaps: ['TypeScript'],
        summary: 'Solid backend.',
      },
      'NATURAL',
    );
    expect(questions).toHaveLength(4);
    expect(questions.every((q) => q.questionText && q.groundedIn)).toBe(true);
  });
});
