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

export const BUCKET_LABELS = {
  STRONG_FIT: 'Strong fit',
  NEEDS_REVIEW: 'Worth a closer look',
  HARD_FILTERED: 'Missing a hard requirement',
};

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
