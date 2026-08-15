import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { downloadJobExport } from '../lib/export';
import { buildReviewPage, latestDecision, PAGE_SIZE } from '../lib/review-queue';
import Layout from '../components/Layout';
import {
  BUCKET_LABELS,
  DECISION_LABELS,
  formatPostedDate,
  userError,
  WORKPLACE_LABELS,
} from '../lib/format';

const BUCKET_COLOR = {
  STRONG_FIT: 'var(--strong-fit)',
  NEEDS_REVIEW: 'var(--needs-review)',
  HARD_FILTERED: 'var(--ink-soft)',
};

const VIEWS = [
  { id: 'to_review', label: 'To review' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'all', label: 'Everyone' },
];

export default function ReviewPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('to_review');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setQuery('');
    setView('to_review');
    setPage(1);
    Promise.all([
      api.get(`/jobs/${jobId}`),
      api.get('/applications', { params: { jobId } }),
    ])
      .then(([jobRes, appsRes]) => {
        if (cancelled) return;
        setJob(jobRes.data);
        setApplications(appsRes.data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(userError(err, 'We couldn’t load candidates for this role. Try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const queue = useMemo(
    () => buildReviewPage(applications, { query, view, page, pageSize: PAGE_SIZE }),
    [applications, query, view, page],
  );
  const { counts } = queue;

  const changeView = (next) => {
    setView(next);
    setPage(1);
  };

  const exportList = async (decision) => {
    setExporting(decision);
    setExportError(null);
    setExportNotice(null);
    try {
      await downloadJobExport(jobId, decision);
      setExportNotice(
        decision === 'SHORTLIST'
          ? 'Downloaded your shortlist. Open the spreadsheet to share or email people.'
          : 'Downloaded everyone for this role.',
      );
    } catch (err) {
      setExportError(userError(err, "We couldn't export that list. Try again."));
    } finally {
      setExporting(null);
    }
  };

  return (
    <Layout>
      <Link to="/" className="muted" style={{ fontSize: 14, textDecoration: 'none' }}>← All roles</Link>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="page-title">{job?.title || 'Review candidates'}</h2>
          {job && (
            <p className="muted" style={{ marginTop: 6 }}>
              Posted {formatPostedDate(job.postedAt)}
              {job.location ? ` · ${job.location}` : ''}
              {job.workplace ? ` · ${WORKPLACE_LABELS[job.workplace]}` : ''}
              {applications.length > 0 ? ` · ${applications.length} candidate${applications.length === 1 ? '' : 's'}` : ''}
            </p>
          )}
        </div>
        {!loading && applications.length > 0 && (
          <Link className="btn" to={`/jobs/${jobId}/upload`}>Upload resumes</Link>
        )}
      </div>

      {error && <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>}
      {exportError && <div className="error-banner" style={{ marginTop: 16 }}>{exportError}</div>}
      {exportNotice && <div className="success-banner" style={{ marginTop: 16 }}>{exportNotice}</div>}

      {loading ? (
        <p className="muted">Loading candidates…</p>
      ) : applications.length === 0 ? (
        <div className="empty">
          No applications yet for this role.
          <div style={{ marginTop: 14 }}>
            <Link className="btn btn-primary" to={`/jobs/${jobId}/upload`}>Upload resumes</Link>
          </div>
        </div>
      ) : (
        <div className="review-desk">
          <div className="queue-stats">
            <button type="button" className={`queue-stat ${view === 'to_review' ? 'is-active' : ''}`} onClick={() => changeView('to_review')}>
              <span className="mono">{counts.toReview}</span>
              to review
            </button>
            <button type="button" className={`queue-stat ${view === 'shortlisted' ? 'is-active' : ''}`} onClick={() => changeView('shortlisted')}>
              <span className="mono">{counts.shortlisted}</span>
              shortlisted
            </button>
            {counts.scoring > 0 && (
              <span className="queue-stat is-plain">
                <span className="mono">{counts.scoring}</span>
                still scoring
              </span>
            )}
            {counts.unread > 0 && (
              <button type="button" className={`queue-stat ${view === 'unread' ? 'is-active' : ''}`} onClick={() => changeView('unread')}>
                <span className="mono">{counts.unread}</span>
                couldn’t read
              </button>
            )}
            {counts.shortlisted > 0 && (
              <button
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                disabled={Boolean(exporting)}
                onClick={() => exportList('SHORTLIST')}
              >
                {exporting === 'SHORTLIST' ? 'Preparing shortlist…' : 'Export shortlist'}
              </button>
            )}
          </div>

          <div className="queue-toolbar">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Find a name or email"
              aria-label="Find a name or email"
            />
            <div className="queue-tabs" role="tablist">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={view === item.id}
                  className={`queue-tab ${view === item.id ? 'is-active' : ''}`}
                  onClick={() => changeView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {view === 'to_review' && counts.toReview === 0 && !query.trim() ? (
            <div className="empty" style={{ padding: 32 }}>
              You’re through this pile.
              {counts.shortlisted > 0
                ? ` ${counts.shortlisted} shortlisted — export them, or look at everyone.`
                : ' Open Everyone to look back, or upload more resumes.'}
              <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
                {counts.shortlisted > 0 && (
                  <button className="btn btn-primary" onClick={() => changeView('shortlisted')}>
                    See shortlist
                  </button>
                )}
                <button className="btn" onClick={() => changeView('all')}>Everyone</button>
              </div>
            </div>
          ) : queue.total === 0 ? (
            <div className="empty" style={{ padding: 32 }}>
              {query.trim()
                ? 'No one matches that search. Try a different name, or clear the box.'
                : view === 'shortlisted'
                  ? 'No one shortlisted yet. Open a candidate and tap Shortlist.'
                  : 'Nobody in this list yet.'}
            </div>
          ) : (
            <>
              <div className="queue-list">
                {queue.items.map((application) => {
                  const decision = latestDecision(application);
                  const isNext = queue.nextUp?.id === application.id;
                  const bucket = application.score?.bucket;
                  return (
                    <Link
                      key={application.id}
                      to={`/applications/${application.id}`}
                      className={`queue-row ${isNext ? 'is-next' : ''}`}
                    >
                      <span className="mono queue-score" style={{ color: BUCKET_COLOR[bucket] || 'var(--ink-soft)' }}>
                        {application.score ? application.score.fitScore : '—'}
                      </span>
                      <span className="queue-who">
                        <span className="queue-name">
                          {isNext && <span className="queue-next-label">Next</span>}
                          {application.candidate?.name || 'Unnamed candidate'}
                        </span>
                        {application.candidate?.email && (
                          <span className="muted" style={{ fontSize: 12 }}>{application.candidate.email}</span>
                        )}
                      </span>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {application.failureReason
                          ? 'Couldn’t read this file'
                          : BUCKET_LABELS[bucket] || (application.score ? '' : 'Still scoring')}
                      </span>
                      <span>
                        {decision ? (
                          <span className="chip">{DECISION_LABELS[decision]}</span>
                        ) : (
                          <span className="muted" style={{ fontSize: 13 }}>{isNext ? 'Open to decide' : ''}</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="queue-footer">
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {queue.start}–{queue.end} of {queue.total}
                </p>
                {queue.pageCount > 1 && (
                  <div className="row">
                    <button className="btn" disabled={queue.page === 1} onClick={() => setPage(queue.page - 1)}>
                      Previous
                    </button>
                    <button className="btn" disabled={queue.page === queue.pageCount} onClick={() => setPage(queue.page + 1)}>
                      Next
                    </button>
                  </div>
                )}
                {view === 'all' && (
                  <button className="btn-quiet" disabled={Boolean(exporting)} onClick={() => exportList('ALL')}>
                    {exporting === 'ALL' ? 'Preparing list…' : 'Export everyone'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
