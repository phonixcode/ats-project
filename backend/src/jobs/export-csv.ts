export type ExportDecision = 'SHORTLIST' | 'MAYBE' | 'REJECT' | 'ALL';

export const EXPORT_DECISIONS: ExportDecision[] = [
  'SHORTLIST',
  'MAYBE',
  'REJECT',
  'ALL',
];

const FIT_LABELS: Record<string, string> = {
  STRONG_FIT: 'Strong fit',
  NEEDS_REVIEW: 'Worth a closer look',
  HARD_FILTERED: 'Missing a hard requirement',
};

const DECISION_LABELS: Record<string, string> = {
  SHORTLIST: 'Shortlisted',
  MAYBE: 'Maybe later',
  REJECT: 'Not this time',
};

const CSV_COLUMNS = [
  'Name',
  'Email',
  'Phone',
  'Score',
  'Fit',
  'Your call',
  'Notes',
  'Role',
  'Posted',
  'Resume file',
] as const;

export interface CandidateExportSource {
  candidate?: {
    name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  score?: { fitScore: number; bucket: string } | null;
  reviews?: { humanDecision: string; note: string | null }[];
  rawFilePath?: string | null;
}

export interface CandidateExportJob {
  title: string;
  postedAt: Date | string;
}

export interface CandidateExportRow {
  name: string;
  email: string;
  phone: string;
  score: string;
  fit: string;
  decision: string;
  notes: string;
  role: string;
  posted: string;
  resumeFile: string;
}

export function latestReview(
  reviews: { humanDecision: string; note: string | null }[] | undefined,
) {
  return reviews?.[0] ?? null;
}

export function shouldIncludeInExport(
  source: CandidateExportSource,
  decision: ExportDecision,
): boolean {
  if (decision === 'ALL') return true;
  return latestReview(source.reviews)?.humanDecision === decision;
}

export function formatPostedForExport(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function resumeFileName(rawFilePath?: string | null): string {
  if (!rawFilePath) return '';
  const parts = rawFilePath.split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

export function toExportRow(
  job: CandidateExportJob,
  source: CandidateExportSource,
): CandidateExportRow {
  const review = latestReview(source.reviews);
  return {
    name: source.candidate?.name?.trim() || 'Unnamed candidate',
    email: source.candidate?.email ?? '',
    phone: source.candidate?.phone ?? '',
    score: source.score != null ? String(source.score.fitScore) : '',
    fit: source.score
      ? (FIT_LABELS[source.score.bucket] ?? source.score.bucket)
      : '',
    decision: review
      ? (DECISION_LABELS[review.humanDecision] ?? review.humanDecision)
      : '',
    notes: review?.note ?? '',
    role: job.title,
    posted: formatPostedForExport(job.postedAt),
    resumeFile: resumeFileName(source.rawFilePath),
  };
}

export function toExportRows(
  job: CandidateExportJob,
  applications: CandidateExportSource[],
  decision: ExportDecision,
): CandidateExportRow[] {
  return applications
    .filter((application) => shouldIncludeInExport(application, decision))
    .map((application) => toExportRow(job, application))
    .sort((a, b) => {
      const scoreDelta = Number(b.score || -1) - Number(a.score || -1);
      if (scoreDelta !== 0) return scoreDelta;
      return a.name.localeCompare(b.name);
    });
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCandidateExportCsv(rows: CandidateExportRow[]): string {
  const lines = [
    CSV_COLUMNS.join(','),
    ...rows.map((row) =>
      [
        row.name,
        row.email,
        row.phone,
        row.score,
        row.fit,
        row.decision,
        row.notes,
        row.role,
        row.posted,
        row.resumeFile,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];
  return `\uFEFF${lines.join('\n')}\n`;
}

export function exportFilename(
  jobTitle: string,
  decision: ExportDecision,
  now: Date,
): string {
  const slug =
    jobTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'role';
  const kind =
    decision === 'ALL'
      ? 'everyone'
      : decision === 'MAYBE'
        ? 'maybe-later'
        : decision === 'REJECT'
          ? 'not-this-time'
          : 'shortlist';
  const date = now.toISOString().slice(0, 10);
  return `${slug}-${kind}-${date}.csv`;
}
