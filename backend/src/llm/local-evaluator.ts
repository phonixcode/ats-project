import type {
  AuthenticitySignalResult,
  ExtractedResumeData,
  FitScoreResult,
  InterviewQuestionResult,
  JobPosting,
  RequirementCheck,
} from './llm-provider.interface';

const SKILL_ALIASES: Record<string, string> = {
  'node.js': 'nodejs',
  nodejs: 'nodejs',
  node: 'nodejs',
  react: 'react',
  postgres: 'postgres',
  postgresql: 'postgres',
  aws: 'aws',
  docker: 'docker',
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
};

const BUZZWORDS = [
  'synergistic',
  'results-driven',
  'cutting-edge',
  'world-class',
  'thought leadership',
  'passionate',
  'leverage',
  'paradigm',
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.+#]+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .map((token) => SKILL_ALIASES[token] ?? token);
}

function haystack(resume: ExtractedResumeData): string {
  return normalize(
    [
      resume.summary,
      ...(resume.skills ?? []),
      ...(resume.education ?? []).map(
        (item) => `${item.degree} ${item.institution}`,
      ),
    ].join(' '),
  );
}

function mentions(text: string, requirement: string): boolean {
  const needles = tokens(requirement);
  if (needles.length === 0) return false;
  return needles.every((needle) => text.includes(needle));
}

export function extractResumeLocally(resumeText: string): ExtractedResumeData {
  const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = resumeText.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const firstLine =
    resumeText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.includes('@') && !/\d{6,}/.test(line)) ??
    null;
  const skillLine = resumeText.match(/skills?:\s*(.+)/i);
  const listedSkills = skillLine
    ? skillLine[1]
        .split(/[,|/]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const known = Object.keys(SKILL_ALIASES).filter((name) =>
    normalize(resumeText).includes(name),
  );
  const skills = [
    ...new Set([
      ...listedSkills,
      ...known.map((name) =>
        name === 'node.js' || name === 'nodejs' || name === 'node'
          ? 'Node.js'
          : name === 'postgres' || name === 'postgresql'
            ? 'Postgres'
            : name.charAt(0).toUpperCase() + name.slice(1),
      ),
    ]),
  ];
  return {
    name: firstLine,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[1]?.trim() ?? null,
    skills,
    yearsOfExperience: null,
    education: [],
    employmentGaps: [],
    summary: resumeText.slice(0, 400).trim(),
  };
}

export function evaluateFitLocally(
  resume: ExtractedResumeData,
  posting: JobPosting,
): FitScoreResult {
  const text = haystack(resume);
  const mustHaves =
    posting.mustHaves.length > 0
      ? posting.mustHaves
      : posting.skills.length > 0
        ? posting.skills
        : tokens(posting.description)
            .filter((token) => token.length > 3)
            .slice(0, 6);
  const niceToHaves = posting.niceToHaves;
  const checks: RequirementCheck[] = [
    ...mustHaves.map((requirement) => ({
      requirement,
      kind: 'must_have' as const,
      status: mentions(text, requirement)
        ? ('met' as const)
        : ('missing' as const),
    })),
    ...niceToHaves.map((requirement) => ({
      requirement,
      kind: 'nice_to_have' as const,
      status: mentions(text, requirement)
        ? ('met' as const)
        : ('missing' as const),
    })),
  ];

  const mustMet = checks.filter(
    (check) => check.kind === 'must_have' && check.status === 'met',
  ).length;
  const mustTotal = Math.max(
    checks.filter((check) => check.kind === 'must_have').length,
    1,
  );
  const niceMet = checks.filter(
    (check) => check.kind === 'nice_to_have' && check.status === 'met',
  ).length;
  const niceTotal = checks.filter(
    (check) => check.kind === 'nice_to_have',
  ).length;

  let yearsScore = 70;
  if (posting.minYears != null && resume.yearsOfExperience != null) {
    yearsScore =
      resume.yearsOfExperience >= posting.minYears
        ? 100
        : Math.round((resume.yearsOfExperience / posting.minYears) * 80);
    checks.push({
      requirement: `${posting.minYears}+ years of experience`,
      kind: 'must_have',
      status: resume.yearsOfExperience >= posting.minYears ? 'met' : 'partial',
    });
  }

  const skillScore = Math.round((mustMet / mustTotal) * 100);
  const niceScore =
    niceTotal === 0 ? 70 : Math.round((niceMet / niceTotal) * 100);
  const fitScore = Math.min(
    100,
    Math.round(skillScore * 0.55 + yearsScore * 0.3 + niceScore * 0.15),
  );

  const strengths = checks
    .filter((check) => check.status === 'met')
    .map((check) => `Shows ${check.requirement}`);
  const gaps = checks
    .filter((check) => check.status !== 'met')
    .map((check) => `Thin on ${check.requirement}`);

  return {
    fitScore,
    rationale: {
      strengths:
        strengths.length > 0
          ? strengths
          : ['Background is readable and can be reviewed.'],
      gaps: gaps.length > 0 ? gaps : [],
      summary:
        fitScore >= 70
          ? 'On paper this looks like a solid match for the posting.'
          : 'Some core parts of the posting are missing or thin on the resume.',
    },
    requirementChecks: checks,
  };
}

export function assessAuthenticityLocally(
  resumeText: string,
): AuthenticitySignalResult {
  const lower = resumeText.toLowerCase();
  const hits = BUZZWORDS.filter((word) => lower.includes(word)).length;
  if (hits >= 3) {
    return {
      signal: 'TEMPLATED',
      reasoning:
        'The writing leans on generic buzzwords and little specific detail.',
    };
  }
  if (/\d/.test(resumeText) || resumeText.length > 200) {
    return {
      signal: 'NATURAL',
      reasoning:
        'The writing includes specific detail rather than stock phrases.',
    };
  }
  return {
    signal: 'UNCERTAIN',
    reasoning: 'There is not enough text to judge how this reads.',
  };
}

export function generateQuestionsLocally(
  resume: ExtractedResumeData,
  fitRationale: FitScoreResult['rationale'],
  authenticitySignal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN',
): InterviewQuestionResult[] {
  const skill = resume.skills[0] ?? 'a listed skill';
  const strength =
    fitRationale.strengths[0] ?? resume.summary ?? 'their recent work';
  const gap = fitRationale.gaps[0] ?? 'a thinner part of the posting';
  const questions: InterviewQuestionResult[] = [
    {
      questionText: `Walk me through a real project where you used ${skill}. What broke, and what did you change?`,
      category: 'VERIFY_CLAIM',
      groundedIn: skill,
    },
    {
      questionText: `The posting looks light on ${gap.replace(/^Thin on /i, '')}. How have you handled that in practice?`,
      category: 'PROBE_GAP',
      groundedIn: gap,
    },
    {
      questionText: `You look strongest on ${strength.replace(/^Shows /i, '')}. What would you do differently next time?`,
      category: 'EXPLORE_STRENGTH',
      groundedIn: strength,
    },
  ];
  if (authenticitySignal !== 'NATURAL') {
    questions.push({
      questionText:
        'Pick one line on this resume that only you could have written. Tell me the story behind it.',
      category: 'AUTHENTICITY_CHECK',
      groundedIn: 'resume voice',
    });
  } else {
    questions.push({
      questionText: `What part of ${resume.summary || 'this work'} are you most proud of, and why?`,
      category: 'EXPLORE_STRENGTH',
      groundedIn: resume.summary || strength,
    });
  }
  return questions;
}
