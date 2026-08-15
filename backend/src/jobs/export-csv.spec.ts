import {
  buildCandidateExportCsv,
  csvEscape,
  exportFilename,
  shouldIncludeInExport,
  toExportRows,
} from './export-csv';

const job = { title: 'Backend Engineer', postedAt: new Date('2026-08-15T10:00:00Z') };

const shortlisted = {
  candidate: {
    name: 'Qudus Oyetola',
    email: 'qudus@example.com',
    phone: '+2348000000000',
  },
  score: { fitScore: 85, bucket: 'STRONG_FIT' },
  reviews: [{ humanDecision: 'SHORTLIST', note: 'Strong Node.js' }],
  rawFilePath: '/uploads/Qudus_Oyetola_Resume.pdf',
};

const maybeLater = {
  candidate: { name: 'Ada Okonkwo', email: 'ada@example.com', phone: null },
  score: { fitScore: 62, bucket: 'NEEDS_REVIEW' },
  reviews: [{ humanDecision: 'MAYBE', note: null }],
  rawFilePath: null,
};

const undecided = {
  candidate: { name: 'Chioma', email: null, phone: null },
  score: { fitScore: 71, bucket: 'STRONG_FIT' },
  reviews: [],
  rawFilePath: null,
};

describe('shouldIncludeInExport', () => {
  it('keeps only the latest call for a named list', () => {
    expect(shouldIncludeInExport(shortlisted, 'SHORTLIST')).toBe(true);
    expect(shouldIncludeInExport(maybeLater, 'SHORTLIST')).toBe(false);
    expect(shouldIncludeInExport(undecided, 'SHORTLIST')).toBe(false);
  });

  it('includes everyone when exporting all', () => {
    expect(shouldIncludeInExport(undecided, 'ALL')).toBe(true);
    expect(shouldIncludeInExport(shortlisted, 'ALL')).toBe(true);
  });
});

describe('toExportRows', () => {
  it('uses recruiter language and sorts by score', () => {
    const rows = toExportRows(job, [maybeLater, shortlisted, undecided], 'ALL');
    expect(rows.map((row) => row.name)).toEqual([
      'Qudus Oyetola',
      'Chioma',
      'Ada Okonkwo',
    ]);
    expect(rows[0]).toMatchObject({
      score: '85',
      fit: 'Strong fit',
      decision: 'Shortlisted',
      notes: 'Strong Node.js',
      role: 'Backend Engineer',
      resumeFile: 'Qudus_Oyetola_Resume.pdf',
    });
    expect(rows[2].decision).toBe('Maybe later');
    expect(rows[1].decision).toBe('');
  });

  it('exports only the shortlist when asked', () => {
    const rows = toExportRows(job, [maybeLater, shortlisted, undecided], 'SHORTLIST');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Qudus Oyetola');
  });
});

describe('buildCandidateExportCsv', () => {
  it('quotes commas and quotes, and starts with a UTF-8 BOM for Excel', () => {
    const csv = buildCandidateExportCsv([
      {
        name: 'Oyetola, Qudus',
        email: 'a@b.com',
        phone: '',
        score: '85',
        fit: 'Strong fit',
        decision: 'Shortlisted',
        notes: 'Said "yes" to Lagos',
        role: 'Backend Engineer',
        posted: '15 Aug 2026',
        resumeFile: 'resume.pdf',
      },
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Oyetola, Qudus"');
    expect(csv).toContain('"Said ""yes"" to Lagos"');
    expect(csv).toContain('Name,Email,Phone,Score,Fit,Your call,Notes,Role,Posted,Resume file');
  });
});

describe('csvEscape', () => {
  it('leaves plain values alone', () => {
    expect(csvEscape('Qudus')).toBe('Qudus');
  });
});

describe('exportFilename', () => {
  it('builds a safe, dated filename', () => {
    expect(
      exportFilename('Backend Engineer', 'SHORTLIST', new Date('2026-08-15T12:00:00Z')),
    ).toBe('backend-engineer-shortlist-2026-08-15.csv');
    expect(
      exportFilename('Staff Engineer (Remote)', 'MAYBE', new Date('2026-08-15T12:00:00Z')),
    ).toBe('staff-engineer-remote-maybe-later-2026-08-15.csv');
  });
});
