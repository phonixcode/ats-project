export const PAGE_SIZE = 20;

export function latestDecision(application) {
  return application.reviews?.[0]?.humanDecision ?? null;
}

export function candidateName(application) {
  return application.candidate?.name?.trim() || 'Unnamed candidate';
}

export function matchesQuery(application, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    application.candidate?.name,
    application.candidate?.email,
    application.candidate?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function inView(application, view) {
  const decision = latestDecision(application);
  if (view === 'to_review') {
    return Boolean(application.score) && !decision && !application.failureReason;
  }
  if (view === 'shortlisted') return decision === 'SHORTLIST';
  if (view === 'maybe') return decision === 'MAYBE';
  if (view === 'passed') return decision === 'REJECT';
  if (view === 'unread') return Boolean(application.failureReason);
  return true;
}

export function compareByScore(left, right) {
  const scoreDelta = (right.score?.fitScore ?? -1) - (left.score?.fitScore ?? -1);
  if (scoreDelta !== 0) return scoreDelta;
  return candidateName(left).localeCompare(candidateName(right));
}

export function summarizeQueue(applications) {
  const counts = {
    toReview: 0,
    shortlisted: 0,
    maybe: 0,
    passed: 0,
    unread: 0,
    scoring: 0,
    total: applications.length,
  };
  for (const application of applications) {
    if (application.failureReason) {
      counts.unread += 1;
      continue;
    }
    if (!application.score) {
      counts.scoring += 1;
      continue;
    }
    const decision = latestDecision(application);
    if (decision === 'SHORTLIST') counts.shortlisted += 1;
    else if (decision === 'MAYBE') counts.maybe += 1;
    else if (decision === 'REJECT') counts.passed += 1;
    else counts.toReview += 1;
  }
  return counts;
}

export function buildReviewPage(applications, options) {
  const query = options.query ?? '';
  const view = options.view ?? 'to_review';
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const counts = summarizeQueue(applications);

  const filtered = [];
  for (const application of applications) {
    if (!matchesQuery(application, query)) continue;
    if (!inView(application, view)) continue;
    filtered.push(application);
  }
  filtered.sort(compareByScore);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);
  const startIndex = (page - 1) * pageSize;
  const items = filtered.slice(startIndex, startIndex + pageSize);

  return {
    counts,
    total,
    page,
    pageCount,
    start: total === 0 ? 0 : startIndex + 1,
    end: Math.min(startIndex + pageSize, total),
    items,
    nextUp:
      view === 'to_review' && page === 1 && !query.trim() ? (filtered[0] ?? null) : null,
  };
}
