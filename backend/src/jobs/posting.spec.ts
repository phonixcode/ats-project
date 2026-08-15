import { jobToPosting } from './posting';

describe('jobToPosting', () => {
  it('prefers typed must-haves over legacy skills', () => {
    const posting = jobToPosting({
      title: 'Engineer',
      description: 'Build APIs',
      location: 'Lagos',
      workplace: 'REMOTE',
      employmentType: 'FULL_TIME',
      seniority: 'MID',
      mustHaves: ['3 years backend'],
      niceToHaves: ['AWS'],
      skills: ['Node.js'],
      minYears: 3,
      education: null,
      requirementsJson: { skills: ['legacy'], minYears: 1 },
    } as any);

    expect(posting.mustHaves).toEqual(['3 years backend']);
    expect(posting.minYears).toBe(3);
    expect(posting.skills).toEqual(['Node.js']);
  });

  it('falls back to legacy requirements when must-haves are empty', () => {
    const posting = jobToPosting({
      title: 'Engineer',
      description: '',
      location: null,
      workplace: null,
      employmentType: null,
      seniority: null,
      mustHaves: [],
      niceToHaves: [],
      skills: [],
      minYears: null,
      education: null,
      requirementsJson: { skills: ['Postgres'], minYears: 2 },
    } as any);

    expect(posting.mustHaves).toEqual(['Postgres']);
    expect(posting.minYears).toBe(2);
  });
});
