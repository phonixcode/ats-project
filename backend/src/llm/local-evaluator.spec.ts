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

  it('finds skills and years later in the resume, not just the header', () => {
    const extracted = extractResumeLocally(`
Qudus Oyetola
Software Engineer
qudus@example.com

Experience
Backend Engineer, Acme Ltd, 2019 – Present
Built billing APIs on Node.js and Postgres after a production outage.
    `);
    expect(extracted.skills).toEqual(
      expect.arrayContaining(['Node.js', 'Postgres']),
    );
    expect(extracted.yearsOfExperience).toBeGreaterThanOrEqual(5);
    expect(extracted.summary.toLowerCase()).not.toMatch(/^resume\b/);
    expect(extracted.summary).toMatch(/Node\.js/);
  });
});

const backendPosting = {
  title: 'Backend Engineer',
  description:
    'About the role: we are looking for someone who will join our team. Need Node.js, Postgres, and AWS. 5+ years.',
  mustHaves: [] as string[],
  niceToHaves: [] as string[],
  skills: [] as string[],
  minYears: null as number | null,
};

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
      '',
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
      '',
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

  it('does not invent filler words from a description-only posting', () => {
    const result = evaluateFitLocally(
      {
        name: 'Ada',
        email: null,
        phone: null,
        skills: ['Node.js', 'Postgres', 'AWS'],
        yearsOfExperience: 6,
        education: [],
        employmentGaps: [],
        summary:
          'Backend engineer. Named skills include Node.js, Postgres, and AWS.',
      },
      '',
      backendPosting,
    );
    const labels = result.requirementChecks.map((check) =>
      check.requirement.toLowerCase(),
    );
    expect(labels.some((label) => label.includes('about'))).toBe(false);
    expect(labels.some((label) => label.includes('role'))).toBe(false);
    expect(labels.some((label) => label.includes('looking'))).toBe(false);
    expect(result.requirementChecks.map((check) => check.requirement)).toEqual(
      expect.arrayContaining(['Node.js', 'Postgres']),
    );
  });

  it('gives a high score and readable verdict when the resume matches the posting', () => {
    const result = evaluateFitLocally(
      {
        name: 'Ada',
        email: null,
        phone: null,
        skills: ['Node.js', 'Postgres', 'AWS'],
        yearsOfExperience: 6,
        education: [],
        employmentGaps: [],
        summary:
          'Backend engineer. Named skills include Node.js, Postgres, and AWS.',
      },
      '',
      backendPosting,
    );
    expect(result.fitScore).toBeGreaterThanOrEqual(75);
    expect(
      result.requirementChecks.some(
        (check) => check.requirement === 'Node.js' && check.status === 'met',
      ),
    ).toBe(true);
    expect(result.rationale.strengths[0]).toMatch(
      /resume names|background in/i,
    );
    expect(result.rationale.strengths[0].split(' ').length).toBeGreaterThan(5);
    expect(result.rationale.summary).toMatch(/strong match|closer look/i);
    expect(result.rationale.summary).toMatch(/Backend Engineer/);
    expect(result.rationale.summary.toLowerCase()).not.toContain('shows about');
  });

  it('scores a weak resume lower and explains the real gaps', () => {
    const result = evaluateFitLocally(
      {
        name: 'Bea',
        email: null,
        phone: null,
        skills: ['Excel'],
        yearsOfExperience: 1,
        education: [],
        employmentGaps: [],
        summary: 'Recent graduate. Named skills include Excel.',
      },
      '',
      backendPosting,
    );
    expect(result.fitScore).toBeLessThan(55);
    expect(
      result.requirementChecks.some(
        (check) =>
          check.kind === 'must_have' &&
          check.status === 'missing' &&
          /node|postgres|backend/i.test(check.requirement),
      ),
    ).toBe(true);
    expect(result.rationale.gaps[0]).toMatch(
      /posting asks for|little sign of/i,
    );
    expect(result.rationale.gaps[0].toLowerCase()).not.toContain('thin on');
    expect(result.rationale.summary).toMatch(/stretch|closer look/i);
  });

  it('scores a sales resume against a sales posting, not engineering tools', () => {
    const result = evaluateFitLocally(
      {
        name: 'Chidi',
        email: null,
        phone: null,
        skills: ['Salesforce', 'HubSpot', 'Cold calling', 'B2B'],
        yearsOfExperience: 5,
        education: [],
        employmentGaps: [],
        summary:
          'Account Executive. Named skills include Salesforce, HubSpot, and Cold calling. Recent title: Account Executive, Acme Ltd.',
      },
      '',
      {
        title: 'Sales Manager',
        description:
          'About the role: we need someone who can run a B2B pipeline on Salesforce and HubSpot. 4+ years.',
        mustHaves: [],
        niceToHaves: [],
        skills: [],
        minYears: null,
      },
    );
    const labels = result.requirementChecks.map((check) => check.requirement);
    expect(labels.some((label) => /node|postgres|backend/i.test(label))).toBe(
      false,
    );
    expect(labels).toEqual(expect.arrayContaining(['Salesforce', 'HubSpot']));
    expect(result.fitScore).toBeGreaterThanOrEqual(75);
    expect(result.rationale.summary).toMatch(/Sales Manager/);
    expect(result.rationale.strengths.join(' ')).toMatch(
      /sales work|Salesforce|HubSpot/i,
    );
  });

  it('scores a nurse against a nursing posting', () => {
    const result = evaluateFitLocally(
      {
        name: 'Amaka',
        email: null,
        phone: null,
        skills: ['Patient care', 'BLS', 'ICU'],
        yearsOfExperience: 7,
        education: [],
        employmentGaps: [],
        summary:
          'Staff Nurse. Named skills include Patient care, BLS, and ICU. Recent title: Staff Nurse, Lagos General Hospital.',
      },
      '',
      {
        title: 'Registered Nurse',
        description:
          'About the role: looking for a nurse for the ICU with BLS and strong patient care. 3+ years.',
        mustHaves: [],
        niceToHaves: [],
        skills: [],
        minYears: null,
      },
    );
    expect(result.fitScore).toBeGreaterThanOrEqual(75);
    expect(
      result.requirementChecks.some(
        (check) =>
          /nursing|clinical|patient|bls|icu/i.test(check.requirement) &&
          check.status === 'met',
      ),
    ).toBe(true);
    expect(result.rationale.summary).toMatch(/Registered Nurse/);
  });

  it('scores an accountant against a finance posting', () => {
    const result = evaluateFitLocally(
      {
        name: 'Tunde',
        email: null,
        phone: null,
        skills: ['IFRS', 'Excel', 'ICAN', 'Reconciliation'],
        yearsOfExperience: 6,
        education: [],
        employmentGaps: [],
        summary:
          'Accountant. Named skills include IFRS, Excel, ICAN, and Reconciliation. Recent title: Accountant, First Bank.',
      },
      '',
      {
        title: 'Accountant',
        description:
          'About the role: we need IFRS, Excel, and reconciliation. ICAN is a plus. 4+ years.',
        mustHaves: [],
        niceToHaves: [],
        skills: [],
        minYears: null,
      },
    );
    expect(result.fitScore).toBeGreaterThanOrEqual(75);
    expect(result.requirementChecks.map((check) => check.requirement)).toEqual(
      expect.arrayContaining(['IFRS', 'Excel']),
    );
  });

  it('scores a teacher against a teaching posting', () => {
    const result = evaluateFitLocally(
      {
        name: 'Bisi',
        email: null,
        phone: null,
        skills: ['Lesson planning', 'Curriculum', 'Classroom management'],
        yearsOfExperience: 8,
        education: [],
        employmentGaps: [],
        summary:
          'Class Teacher. Named skills include Lesson planning, Curriculum, and Classroom management. Recent title: Class Teacher, St Marys.',
      },
      '',
      {
        title: 'Primary School Teacher',
        description:
          'About the role: we need lesson planning, curriculum work, and classroom management. 3+ years.',
        mustHaves: [],
        niceToHaves: [],
        skills: [],
        minYears: null,
      },
    );
    expect(result.fitScore).toBeGreaterThanOrEqual(75);
    expect(result.rationale.summary).toMatch(/Teacher/);
  });

  it('still scores a sales resume low for a backend job', () => {
    const result = evaluateFitLocally(
      {
        name: 'Chidi',
        email: null,
        phone: null,
        skills: ['Salesforce', 'HubSpot'],
        yearsOfExperience: 5,
        education: [],
        employmentGaps: [],
        summary:
          'Account Executive. Named skills include Salesforce and HubSpot.',
      },
      '',
      backendPosting,
    );
    expect(result.fitScore).toBeLessThan(55);
  });

  it('uses the job title when the field is not in the dictionary', () => {
    const result = evaluateFitLocally(
      {
        name: 'Ife',
        email: null,
        phone: null,
        skills: [],
        yearsOfExperience: 6,
        education: [],
        employmentGaps: [],
        summary:
          'Ife has a readable resume. Recent title: Marine Surveyor, Acme Ltd, 2019 – Present.',
      },
      '',
      {
        title: 'Marine Surveyor',
        description:
          'About the role: we are looking for someone who will join our inspection team. 5+ years.',
        mustHaves: [],
        niceToHaves: [],
        skills: [],
        minYears: null,
      },
    );
    const labels = result.requirementChecks.map((check) =>
      check.requirement.toLowerCase(),
    );
    expect(labels.some((label) => label.includes('about'))).toBe(false);
    expect(labels).toEqual(expect.arrayContaining(['marine', 'surveyor']));
    expect(
      result.requirementChecks.filter((check) => check.status === 'met').length,
    ).toBeGreaterThan(0);
    expect(result.rationale.summary).toMatch(/Marine Surveyor/);
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

describe('evaluateFitLocally on non-tech roles', () => {
  const complianceResume = `Amaka Obi
amaka.obi@example.com
Compliance Officer, First Harbour Bank, 2018 - Present
- Ran transaction monitoring and suspicious activity reporting for retail banking
- Wrote the firm's regulatory reporting pack for the central bank every quarter
- Led annual enterprise risk assessment and policy reviews
Compliance Analyst, Crest Microfinance, 2015 - 2018`;

  const compliancePosting = {
    title: 'Senior Compliance Officer',
    description: 'Own AML monitoring, regulatory reporting and risk assessment.',
    mustHaves: ['Regulatory reporting', 'Risk assessment', 'Transaction monitoring'],
    niceToHaves: [] as string[],
    skills: [] as string[],
    minYears: 5,
  };

  it('finds requirements in the work history, not just the skills list', () => {
    const resume = extractResumeLocally(complianceResume);
    const withText = evaluateFitLocally(resume, complianceResume, compliancePosting);
    const withoutText = evaluateFitLocally(resume, '', compliancePosting);

    const missingMust = (result: typeof withText) =>
      result.requirementChecks.filter(
        (check) => check.kind === 'must_have' && check.status === 'missing',
      );
    expect(missingMust(withText)).toHaveLength(0);
    expect(withText.fitScore).toBeGreaterThanOrEqual(70);
    expect(missingMust(withoutText).length).toBeGreaterThan(0);
  });
});

describe('evaluateFitLocally reads tech postings like a person would', () => {
  const posting = {
    title: 'Software Engineer',
    description:
      'Proficiency in programming languages such as Java, Python, C++, or JavaScript. Experience with modern frameworks (e.g., React, Angular, Node.js, Django). 2+ years of experience.',
    mustHaves: [] as string[],
    niceToHaves: [] as string[],
    skills: [] as string[],
    minYears: null as number | null,
  };

  it('knows Node.js, TypeScript and React mean JavaScript', () => {
    const text =
      'Software Engineer, 2021 - Present. Built APIs in Node.js and TypeScript, dashboards in React.';
    const result = evaluateFitLocally(extractResumeLocally(text), text, posting);
    const js = result.requirementChecks.find((c) => c.requirement === 'JavaScript');
    expect(js?.status).toBe('met');
  });

  it('treats listed examples as nice-to-haves, not must-haves', () => {
    const text =
      'Software Developer, 2020 - Present. .NET, C#, Angular and TypeScript web apps.';
    const result = evaluateFitLocally(extractResumeLocally(text), text, posting);
    const missingMust = result.requirementChecks.filter(
      (c) => c.kind === 'must_have' && c.status === 'missing',
    );
    expect(missingMust).toHaveLength(0);
    expect(result.fitScore).toBeGreaterThanOrEqual(55);
  });
});
