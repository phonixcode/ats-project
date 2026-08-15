import type { Job } from '@prisma/client';
import type { JobPosting } from '../llm/llm-provider.interface';

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function jobToPosting(job: Job): JobPosting {
  const legacy = (job.requirementsJson ?? {}) as Record<string, any>;
  const storedMustHaves = asStringList(job.mustHaves);
  const storedSkills = asStringList(job.skills);
  const mustHaves =
    storedMustHaves.length > 0
      ? storedMustHaves
      : Array.isArray(legacy.skills)
        ? legacy.skills
        : [];
  return {
    title: job.title,
    description: job.description ?? '',
    location: job.location,
    workplace: job.workplace,
    employmentType: job.employmentType,
    seniority: job.seniority,
    mustHaves,
    niceToHaves: asStringList(job.niceToHaves),
    skills: storedSkills.length > 0 ? storedSkills : (legacy.skills ?? []),
    minYears: job.minYears ?? legacy.minYears ?? null,
    education: job.education,
  };
}

export function postingSnapshot(posting: JobPosting) {
  return {
    title: posting.title,
    description: posting.description,
    location: posting.location ?? null,
    workplace: posting.workplace ?? null,
    employmentType: posting.employmentType ?? null,
    seniority: posting.seniority ?? null,
    mustHaves: posting.mustHaves,
    niceToHaves: posting.niceToHaves,
    skills: posting.skills,
    minYears: posting.minYears ?? null,
    education: posting.education ?? null,
  };
}
