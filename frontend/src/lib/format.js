export function formatPostedDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const WORKPLACE_LABELS = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export const EMPLOYMENT_LABELS = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

export const SENIORITY_LABELS = {
  INTERN: 'Intern',
  JUNIOR: 'Junior',
  MID: 'Mid',
  SENIOR: 'Senior',
  STAFF: 'Staff+',
};

export const DECISION_LABELS = {
  SHORTLIST: 'Shortlisted',
  MAYBE: 'Maybe later',
  REJECT: 'Not this time',
};

export const READER_LABELS = {
  openai: 'OpenAI',
  claude: 'Claude',
  gemini: 'Gemini',
  local: 'Local model',
  heuristic: 'Built-in reader (keyword match)',
};

export function matchLabel(score) {
  if (!score) return null;
  if (score.bucket === 'STRONG_FIT') return score.fitScore >= 85 ? 'Strong match' : 'Good match';
  if (score.bucket === 'NEEDS_REVIEW') return 'Possible match';
  return 'Unlikely match';
}

export const AUTHENTICITY_LABELS = {
  NATURAL: 'Sounds like a real person',
  TEMPLATED: 'Reads a bit templated',
  UNCERTAIN: 'Hard to tell from the writing',
};

export function resumeFileName(path) {
  if (!path) return '';
  const parts = String(path).split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

function looksTechnical(message) {
  return /uuid|prisma|exception|stack|econn|timeout|llm|openai|gemini|claude|internal server/i.test(
    message,
  ) || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(message);
}

function statusMessage(status) {
  if (status === 400) {
    return 'Some required fields are missing. Please complete the highlighted fields.';
  }
  if (status === 401) return 'Please log in to continue.';
  if (status === 403) {
    return "You don't have permission to do this. Contact your admin if this seems wrong.";
  }
  if (status === 404) {
    return "We couldn't find what you're looking for. It may have been removed or the link may be wrong.";
  }
  if (status === 409) return 'This has already been updated. Refresh and try again.';
  if (status >= 500) {
    return 'Something went wrong on our end. Please try again, or contact support if it continues.';
  }
  return null;
}

export function userError(err, fallback) {
  if (!err?.response) {
    if (err?.code === 'ECONNABORTED') {
      return 'This is taking longer than expected. Please try again.';
    }
    return "We couldn't connect. Check your internet connection and try again.";
  }

  const status = err.response.status;
  const fromServer = err.response.data?.message;
  const firstMessage = Array.isArray(fromServer) ? fromServer[0] : fromServer;

  if (typeof firstMessage === 'string' && firstMessage && !looksTechnical(firstMessage)) {
    return firstMessage;
  }

  return statusMessage(status) || fallback;
}

export function displayName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Unnamed candidate';
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (match) => match.toUpperCase());
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function attentionLine(jobs) {
  if (jobs.length === 0) return 'Post a role to get started. MG-ATS reads every resume against it so you can focus on the people.';
  const waiting = jobs.filter((job) => job.unreviewedCount > 0);
  const total = waiting.reduce((sum, job) => sum + job.unreviewedCount, 0);
  if (total === 0) return 'You’re all caught up. Nobody is waiting for a decision right now.';
  const people = `${total} ${total === 1 ? 'person is' : 'people are'} waiting for your decision`;
  if (waiting.length === 1) return `${people} in ${waiting[0].title}.`;
  return `${people} across ${waiting.length} roles.`;
}
