import type {
  AuthenticitySignalResult,
  ExtractedResumeData,
  FitScoreResult,
  InterviewQuestionResult,
  JobPosting,
  RequirementCheck,
} from './llm-provider.interface';
import {
  BUZZWORDS,
  NAME_SKIP,
  ROLE_ALIASES,
  ROLE_LABELS,
  ROLE_PATTERNS,
  ROLE_SKILLS,
  SKILLS,
  STOPWORDS,
  TITLE_LINE,
  TITLE_NOISE,
} from './local-evaluator.lexicon';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(?![a-z0-9])/g, ' ')
    .replace(/[^a-z0-9.+#/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  if (!n) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^| )${escaped}(?: |$)`).test(haystack);
}

function findSkills(text: string): string[] {
  const hay = normalize(text);
  const found: string[] = [];
  for (const skill of SKILLS) {
    if (skill.needles.some((needle) => containsPhrase(hay, needle))) {
      found.push(skill.label);
    }
  }
  return [...new Set(found)];
}

function extractYearsFromPhrases(text: string): number | null {
  const mentions = [...text.matchAll(/(\d{1,2})\+?\s*(?:years?|yrs\.?)/gi)];
  const values = mentions
    .map((match) => Number(match[1]))
    .filter((n) => n > 0 && n <= 40);
  return values.length > 0 ? Math.max(...values) : null;
}

function extractYearsFromDates(text: string): number | null {
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((match) =>
    Number(match[0]),
  );
  if (years.length === 0) return null;
  const hasPresent = /\b(present|current|now)\b/i.test(text);
  const end = hasPresent ? new Date().getFullYear() : Math.max(...years);
  const start = Math.min(...years);
  const span = end - start;
  if (span >= 1 && span <= 45) return span;
  return null;
}

function extractEducation(
  resumeText: string,
): { degree: string; institution: string }[] {
  const lines = resumeText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const education: { degree: string; institution: string }[] = [];
  for (const line of lines) {
    if (
      !/(b\.?sc|bachelor|master|m\.?sc|mba|phd|university|polytechnic|college|degree|ican|acca|cpa|cfa|nce|pgde|trcn|nmcn|shrm)/i.test(
        line,
      )
    ) {
      continue;
    }
    education.push({
      degree: line.slice(0, 80),
      institution: line.slice(0, 80),
    });
    if (education.length >= 3) break;
  }
  return education;
}

function notableRoleLine(resumeText: string): string | null {
  const lines = resumeText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 90);
  return (
    lines.find((line) => {
      if (NAME_SKIP.test(line) || line.includes('@')) return false;
      if (TITLE_LINE.test(line)) return true;
      return /(19|20)\d{2}|\bpresent\b/i.test(line) && line.includes(',');
    }) ?? null
  );
}

function cleanRequirement(value: string): string | null {
  const words = normalize(value)
    .split(' ')
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  if (words.length === 0) return null;
  return words.join(' ');
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = normalize(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function roleFromTitle(title: string): string | null {
  const hay = normalize(title);
  for (const { pattern, role } of ROLE_PATTERNS) {
    if (pattern.test(hay)) return role;
  }
  return null;
}

function titleSignals(title: string): string[] {
  return unique(
    normalize(title)
      .split(' ')
      .filter(
        (word) =>
          word.length > 3 && !STOPWORDS.has(word) && !TITLE_NOISE.has(word),
      ),
  ).slice(0, 2);
}

function requirementsFromPosting(posting: JobPosting): {
  must: string[];
  nice: string[];
  minYears: number | null;
} {
  const explicitMust = (posting.mustHaves ?? [])
    .map(cleanRequirement)
    .filter((item): item is string => Boolean(item));
  const explicitNice = (posting.niceToHaves ?? [])
    .map(cleanRequirement)
    .filter((item): item is string => Boolean(item));
  const explicitSkills = (posting.skills ?? [])
    .map(cleanRequirement)
    .filter((item): item is string => Boolean(item));
  const detected = findSkills(`${posting.title}\n${posting.description}`);
  const minYears =
    posting.minYears ?? extractYearsFromPhrases(posting.description);
  const without = (items: string[], blocked: string[]) =>
    items.filter(
      (item) => !blocked.some((block) => normalize(block) === normalize(item)),
    );

  if (explicitMust.length > 0) {
    const must = unique(explicitMust).slice(0, 8);
    return {
      must,
      nice: without(
        unique([...explicitNice, ...explicitSkills, ...detected]),
        must,
      ).slice(0, 6),
      minYears,
    };
  }

  const titleRole = roleFromTitle(posting.title);
  const fallbackTitle =
    !titleRole && detected.length === 0 ? titleSignals(posting.title) : [];
  const must = unique([
    ...(titleRole ? [titleRole] : []),
    ...detected.slice(0, 3),
    ...explicitSkills.slice(0, 2),
    ...fallbackTitle,
  ]).slice(0, 6);

  return {
    must,
    nice: without(
      unique([...detected.slice(3), ...explicitNice, ...explicitSkills]),
      must,
    ).slice(0, 6),
    minYears,
  };
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

function matchWords(
  text: string,
  requirement: string,
): RequirementCheck['status'] {
  const needles = normalize(requirement)
    .split(' ')
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  if (needles.length === 0) return 'missing';
  const hits = needles.filter((needle) => containsPhrase(text, needle)).length;
  if (hits === needles.length) return 'met';
  if (hits > 0) return 'partial';
  return 'missing';
}

function relatedSkillHits(
  role: string,
  skills: string[],
  text: string,
): number {
  const related = ROLE_SKILLS[normalize(role)] ?? [];
  return related.filter(
    (skill) =>
      skills.some((item) => normalize(item) === normalize(skill)) ||
      containsPhrase(text, skill),
  ).length;
}

function matchRequirement(
  text: string,
  skills: string[],
  requirement: string,
): RequirementCheck['status'] {
  const direct = matchWords(text, requirement);
  if (direct === 'met') return 'met';
  const aliases = ROLE_ALIASES[normalize(requirement)] ?? [];
  if (aliases.some((alias) => containsPhrase(text, alias))) return 'met';
  const related = ROLE_SKILLS[normalize(requirement)];
  if (!related) return direct;
  const hits = relatedSkillHits(requirement, skills, text);
  if (hits >= 2) return 'met';
  if (hits === 1 || direct === 'partial') return 'partial';
  return 'missing';
}

function isRoleLabel(label: string): boolean {
  return Object.values(ROLE_LABELS).includes(label);
}

function displayLabel(requirement: string): string {
  const skill = SKILLS.find(
    (item) => normalize(item.label) === normalize(requirement),
  );
  if (skill) return skill.label;
  return ROLE_LABELS[normalize(requirement)] ?? requirement;
}

function listPhrase(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function extractResumeLocally(resumeText: string): ExtractedResumeData {
  const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = resumeText.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const firstLine =
    resumeText
      .split('\n')
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          !line.includes('@') &&
          !/\d{6,}/.test(line) &&
          !NAME_SKIP.test(line) &&
          line.length < 80,
      ) ?? null;
  const skills = findSkills(resumeText);
  const yearsOfExperience =
    extractYearsFromPhrases(resumeText) ?? extractYearsFromDates(resumeText);
  const education = extractEducation(resumeText);
  const roleLine = notableRoleLine(resumeText);
  const who = firstLine || 'This candidate';
  const skillBit =
    skills.length > 0
      ? ` Named skills include ${listPhrase(skills.slice(0, 6))}.`
      : ' Few concrete tools or skills are named.';
  const yearBit =
    yearsOfExperience != null
      ? ` Experience looks like about ${yearsOfExperience} year${yearsOfExperience === 1 ? '' : 's'}.`
      : '';
  const roleBit =
    roleLine && roleLine !== firstLine ? ` Recent title: ${roleLine}.` : '';
  const summary =
    `${who} has a readable resume.${skillBit}${yearBit}${roleBit}`.trim();

  return {
    name: firstLine,
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[1]?.trim() ?? null,
    skills,
    yearsOfExperience,
    education,
    employmentGaps: [],
    summary,
  };
}

export function evaluateFitLocally(
  resume: ExtractedResumeData,
  posting: JobPosting,
): FitScoreResult {
  const text = haystack(resume);
  const skills = resume.skills ?? [];
  const { must, nice, minYears } = requirementsFromPosting(posting);
  const checks: RequirementCheck[] = [
    ...must.map((requirement) => ({
      requirement: displayLabel(requirement),
      kind: 'must_have' as const,
      status: matchRequirement(text, skills, requirement),
    })),
    ...nice.map((requirement) => ({
      requirement: displayLabel(requirement),
      kind: 'nice_to_have' as const,
      status: matchRequirement(text, skills, requirement),
    })),
  ];

  let yearsScore = 70;
  if (minYears != null) {
    const years = resume.yearsOfExperience;
    if (years == null) {
      yearsScore = 58;
      checks.push({
        requirement: `${minYears}+ years of experience`,
        kind: 'must_have',
        status: 'partial',
      });
    } else if (years >= minYears) {
      yearsScore = 100;
      checks.push({
        requirement: `${minYears}+ years of experience`,
        kind: 'must_have',
        status: 'met',
      });
    } else {
      yearsScore = Math.round((years / minYears) * 85);
      checks.push({
        requirement: `${minYears}+ years of experience`,
        kind: 'must_have',
        status: years / minYears >= 0.6 ? 'partial' : 'missing',
      });
    }
  }

  const mustChecks = checks.filter((check) => check.kind === 'must_have');
  const scoreOf = (check: RequirementCheck): number => {
    if (check.status === 'met') return 1;
    if (check.status === 'partial') return 0.5;
    return 0;
  };
  const mustScore =
    mustChecks.length === 0
      ? 62
      : Math.round(
          (mustChecks.reduce((sum, check) => sum + scoreOf(check), 0) /
            mustChecks.length) *
            100,
        );
  const niceChecks = checks.filter((check) => check.kind === 'nice_to_have');
  const niceScore =
    niceChecks.length === 0
      ? 70
      : Math.round(
          (niceChecks.reduce((sum, check) => sum + scoreOf(check), 0) /
            niceChecks.length) *
            100,
        );

  const fitScore = Math.min(
    100,
    Math.max(
      8,
      Math.round(mustScore * 0.62 + yearsScore * 0.23 + niceScore * 0.15),
    ),
  );

  const met = checks.filter((check) => check.status === 'met');
  const missingMust = checks.filter(
    (check) => check.kind === 'must_have' && check.status === 'missing',
  );
  const missingNice = checks.filter(
    (check) => check.kind === 'nice_to_have' && check.status === 'missing',
  );
  const partials = checks.filter((check) => check.status === 'partial');

  const strengths =
    met.length > 0
      ? met.slice(0, 6).map((check) => {
          if (check.requirement.includes('years')) {
            return `Experience looks in range: ${check.requirement}.`;
          }
          if (isRoleLabel(check.requirement)) {
            return `The resume shows a background in ${check.requirement}.`;
          }
          return `The resume names ${check.requirement} in the skills or work history.`;
        })
      : [
          'The resume is readable enough to review against the posting by hand.',
        ];

  const gaps = [
    ...missingMust.map(
      (check) =>
        `The posting asks for ${check.requirement}; it doesn’t show up clearly on the resume.`,
    ),
    ...missingNice.map(
      (check) =>
        `Little sign of ${check.requirement}, which the posting mentioned as a plus.`,
    ),
    ...partials.map(
      (check) =>
        `Only a partial match on ${check.requirement} — worth confirming before you decide.`,
    ),
  ].slice(0, 6);

  const title = posting.title?.trim() || 'this role';
  const metLabels = listPhrase(
    met
      .filter((check) => !check.requirement.includes('years'))
      .map((check) => check.requirement)
      .slice(0, 3),
  );
  const missLabels = listPhrase(
    missingMust.map((check) => check.requirement).slice(0, 3),
  );

  let summary: string;
  if (missingMust.length === 0 && fitScore >= 75) {
    summary = `On paper this is a strong match for ${title}.${metLabels ? ` The resume covers ${metLabels}.` : ''} Open the CV and decide if the story holds — this is a first read, not a hire.`;
  } else if (fitScore >= 55 || missingMust.length <= 1) {
    summary = `Worth a closer look for ${title}.${metLabels ? ` Overlap on ${metLabels}.` : ''}${missLabels ? ` Confirm ${missLabels} before you shortlist.` : ' A few posting asks are thin — confirm those in conversation.'}`;
  } else {
    summary = `A stretch for ${title} on keywords.${missLabels ? ` The posting wants ${missLabels}.` : ''} That can still be the right person if the story isn’t in the buzzwords — open the resume and decide yourself.`;
  }

  return {
    fitScore,
    rationale: {
      strengths,
      gaps,
      summary,
    },
    requirementChecks: checks,
  };
}

export function assessAuthenticityLocally(
  resumeText: string,
): AuthenticitySignalResult {
  const lower = resumeText.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean).length;
  const hits = BUZZWORDS.filter((word) => lower.includes(word)).length;
  const hasNumbers = /\d/.test(resumeText);
  const hasFirstPerson = /\bI\b|\bI'm\b|\bI've\b/.test(resumeText);
  const hasCompanies = /(ltd|limited|inc|llc|gmbh|corp|university|bank)/i.test(
    resumeText,
  );

  if (hits >= 3 && !hasNumbers && !hasFirstPerson) {
    return {
      signal: 'TEMPLATED',
      reasoning:
        'The writing leans on generic buzzwords and doesn’t show specific tools, dates, or results.',
    };
  }
  if (hasNumbers || hasFirstPerson || hasCompanies) {
    return {
      signal: 'NATURAL',
      reasoning:
        'The writing includes specifics — numbers, a first-person voice, or real organisations — rather than stock phrases.',
    };
  }
  if (words < 40) {
    return {
      signal: 'UNCERTAIN',
      reasoning:
        'There isn’t enough writing on the page to tell if this is a real voice or a template.',
    };
  }
  if (hits >= 2) {
    return {
      signal: 'UNCERTAIN',
      reasoning:
        'Some stock phrases show up, but there isn’t a clear tell either way.',
    };
  }
  return {
    signal: 'NATURAL',
    reasoning: 'The writing doesn’t read like a generic template.',
  };
}

export function generateQuestionsLocally(
  resume: ExtractedResumeData,
  fitRationale: FitScoreResult['rationale'],
  authenticitySignal: 'NATURAL' | 'TEMPLATED' | 'UNCERTAIN',
): InterviewQuestionResult[] {
  const skill = resume.skills[0] ?? 'your recent work';
  const strength = stripLead(
    fitRationale.strengths[0] ?? resume.summary ?? 'their recent work',
  );
  const gap = stripLead(
    fitRationale.gaps[0] ?? 'a thinner part of the posting',
  );
  const questions: InterviewQuestionResult[] = [
    {
      questionText: `Walk me through a real example of ${skill}. What was hard, and what did you change?`,
      category: 'VERIFY_CLAIM',
      groundedIn: skill,
    },
    {
      questionText: `The posting still looks light on ${gap}. How have you handled that in practice?`,
      category: 'PROBE_GAP',
      groundedIn: gap,
    },
    {
      questionText: `You look strongest on ${strength}. What would you do differently next time?`,
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
      questionText: 'What part of this work are you most proud of, and why?',
      category: 'EXPLORE_STRENGTH',
      groundedIn: resume.summary || strength,
    });
  }
  return questions;
}

function stripLead(value: string): string {
  return value
    .replace(/^The resume names\s+/i, '')
    .replace(/^The resume shows a background in\s+/i, '')
    .replace(/\s+in the skills or work history\.?$/i, '')
    .replace(/^The posting asks for\s+/i, '')
    .replace(/; it doesn’t show up clearly on the resume\.?$/i, '')
    .replace(/^Little sign of\s+/i, '')
    .replace(/, which the posting mentioned as a plus\.?$/i, '')
    .replace(/^Only a partial match on\s+/i, '')
    .replace(/\s+— worth confirming before you decide\.?$/i, '')
    .replace(/^Experience looks in range:\s+/i, '')
    .replace(/\.$/, '');
}
