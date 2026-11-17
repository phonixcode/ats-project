import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { downloadJobExport } from '../lib/export';
import { buildReviewPage, isStillReading, latestDecision, PAGE_SIZE, readerNote } from '../lib/review-queue';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import { useConfirm } from '../hooks/useConfirm';
import { useReaderStatus } from '../hooks/useReaderStatus';
import ReaderProblemBanner from '../components/ReaderProblemBanner';
import ShortlistPlanner from '../components/ShortlistPlanner';
import {
  matchLabel,
  displayName,
  DECISION_LABELS,
  formatPostedDate,
  userError,
  WORKPLACE_LABELS,
} from '../lib/format';


const VIEW_GUIDES = {
  good_matches:
    'Meets the must-haves on paper, best first. These are the people most worth an interview — read each “Worth asking” line before you decide.',
  possible_matches:
    'Real overlap, with something the resume leaves open. Open each one — some will be worth an interview once that’s settled.',
};

const VIEWS = [
  { id: 'to_review', label: 'To review', count: 'toReview' },
  { id: 'good_matches', label: 'Good matches', count: 'strongFits' },
  { id: 'possible_matches', label: 'Possible matches', count: 'closerLook' },
  { id: 'shortlisted', label: 'Shortlisted', count: 'shortlisted' },
  { id: 'all', label: 'Everyone' },
];

export default function ReviewPage() {
  const { jobId } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  const [confirm, confirmDialog] = useConfirm();
  const [readerStatus, refreshReaderStatus] = useReaderStatus();
  const rescoringRef = useRef(false);
  const [selected, setSelected] = useState(() => new Set());
  const [plannerOpen, setPlannerOpen] = useState(false);

  const query = params.get('q') ?? '';
  const view = params.get('view') ?? 'to_review';
  const page = Number(params.get('page')) || 1;
  const returnTo = `${location.pathname}${location.search}`;

  const updateParams = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
      else next.set(key, String(value));
    }
    setParams(next, { replace: true });
  };

  const loadApplications = useCallback(
    () => api.get('/applications', { params: { jobId, _t: Date.now() } }).then((res) => setApplications(res.data)),
    [jobId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  const stillReading = applications.some(isStillReading);
  const keywordReads = applications.filter((application) =>
    application.modelOpinions?.some((opinion) => opinion.provider === 'heuristic'),
  ).length;
  const showKeywordNote =
    keywordReads > 0 && readerStatus && readerStatus.using !== 'builtin' && !readerStatus.lastFailure;

  useEffect(() => {
    if (!stillReading) return undefined;
    const timer = setInterval(() => {
      loadApplications().catch(() => undefined);
      refreshReaderStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [stillReading, loadApplications, refreshReaderStatus]);

  useEffect(() => {
    if (stillReading || !rescoringRef.current) return;
    rescoringRef.current = false;
    refreshReaderStatus();
    setExportNotice('Finished reading everyone again. Scores and notes below are up to date.');
  }, [stillReading, refreshReaderStatus]);

  const clearSelection = () => setSelected(new Set());
  const changeView = (next) => {
    clearSelection();
    updateParams({ view: next === 'to_review' ? null : next, page: 1 });
  };
  const setPage = (next) => {
    clearSelection();
    updateParams({ page: next });
  };
  const toggleSelected = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedIds = queue.items.filter((application) => selected.has(application.id)).map((a) => a.id);
  const allOnPageSelected = queue.items.length > 0 && selectedIds.length === queue.items.length;
  const toggleAllOnPage = () =>
    setSelected(allOnPageSelected ? new Set() : new Set(queue.items.map((application) => application.id)));

  const decideSelected = async (humanDecision) => {
    setBulkAction(humanDecision);
    setExportError(null);
    setExportNotice(null);
    try {
      const res = await api.post('/applications/bulk-review', { applicationIds: selectedIds, humanDecision });
      await loadApplications();
      clearSelection();
      setExportNotice(`Marked ${res.data.reviewed} candidate${res.data.reviewed === 1 ? '' : 's'} as ${DECISION_LABELS[humanDecision].toLowerCase()}.`);
    } catch (err) {
      setExportError(userError(err, "We couldn't save that decision. Try again."));
    } finally {
      setBulkAction(null);
    }
  };

  const deleteSelected = async () => {
    const count = selectedIds.length;
    const ok = await confirm({
      title: `Delete ${count} candidate${count === 1 ? '' : 's'}?`,
      message:
        'Their scores, notes, decisions and resume files are removed from MG-ATS to free up space. This can’t be undone.',
      confirmLabel: `Delete ${count === 1 ? 'candidate' : 'candidates'}`,
      tone: 'danger',
    });
    if (!ok) return;
    setBulkAction('delete');
    setExportError(null);
    setExportNotice(null);
    try {
      const res = await api.post('/applications/bulk-delete', { applicationIds: selectedIds });
      await loadApplications();
      clearSelection();
      setExportNotice(`Deleted ${res.data.removed} candidate${res.data.removed === 1 ? '' : 's'}.`);
    } catch (err) {
      setExportError(userError(err, "We couldn't delete those candidates. Try again."));
    } finally {
      setBulkAction(null);
    }
  };

  const finishPlanner = async (count) => {
    setPlannerOpen(false);
    setExportError(null);
    await loadApplications();
    setExportNotice(`Shortlisted ${count} ${count === 1 ? 'person' : 'people'}.`);
  };

  const readEveryoneAgain = async () => {
    const ok = await confirm({
      title: `Read all ${applications.length} resume${applications.length === 1 ? '' : 's'} again?`,
      message:
        'MG-ATS reads each resume against the current posting again. New scores and notes replace the old ones as they finish — this can take a while for a big pile. Your shortlist and decisions stay as they are.',
      confirmLabel: 'Read again',
    });
    if (!ok) return;
    setBulkAction('rescore');
    setExportError(null);
    setExportNotice(null);
    try {
      const res = await api.post(`/jobs/${jobId}/rescore`);
      rescoringRef.current = res.data.queued > 0;
      await loadApplications();
      setExportNotice(`Reading ${res.data.queued} resume${res.data.queued === 1 ? '' : 's'} again. Scores update here as they finish.`);
    } catch (err) {
      setExportError(userError(err, "We couldn't start the read. Try again."));
    } finally {
      setBulkAction(null);
    }
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
      <PageHeader
        title={job?.title || 'Review candidates'}
        meta={
          job
            ? [
                `Posted ${formatPostedDate(job.postedAt)}`,
                [job.location, WORKPLACE_LABELS[job.workplace]].filter(Boolean).join(', '),
                applications.length > 0 && `${applications.length} candidate${applications.length === 1 ? '' : 's'}`,
              ]
            : []
        }
        actions={
          !loading &&
          applications.length > 0 && (
            <button className="btn" disabled={Boolean(bulkAction) || stillReading} onClick={readEveryoneAgain}>
              {bulkAction === 'rescore' ? 'Starting…' : stillReading ? 'Reading…' : 'Read everyone again'}
            </button>
          )
        }
      />

      {error && <div className="error-banner" style={{ marginTop: 16 }}>{error}</div>}
      {exportError && <div className="error-banner" style={{ marginTop: 16 }}>{exportError}</div>}
      {exportNotice && <div className="success-banner" style={{ marginTop: 16 }}>{exportNotice}</div>}
      {applications.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <ReaderProblemBanner failure={readerStatus?.lastFailure} />
          {showKeywordNote && (
            <p className="status-note" style={{ margin: 0 }}>
              {keywordReads} of {applications.length} were read by the built-in keyword reader, which can miss things. Use
              Read everyone again for a full read.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading candidates…</p>
      ) : applications.length === 0 ? (
        <div className="empty">
          No applications yet. Upload a zip of resumes and MG-ATS will do the first read.
          <div style={{ marginTop: 14 }}>
            <Link className="btn btn-primary" to={`/jobs/${jobId}/upload`}>Upload resumes</Link>
          </div>
        </div>
      ) : (
        <div className="review-desk">
          {(counts.scoring > 0 || counts.unread > 0) && (
            <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              {counts.scoring > 0 && (
                <span className="pill">{counts.scoring} still being read</span>
              )}
              {counts.unread > 0 && (
                <button type="button" className="btn-quiet" onClick={() => changeView('unread')}>
                  {counts.unread} file{counts.unread === 1 ? '' : 's'} couldn’t be read. View
                </button>
              )}
            </div>
          )}

          <div className="queue-toolbar">
            <input
              value={query}
              onChange={(e) => updateParams({ q: e.target.value, page: 1 })}
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
                  {item.count && counts[item.count] > 0 && <span className="tab-count">{counts[item.count]}</span>}
                </button>
              ))}
            </div>
          </div>

          {VIEW_GUIDES[view] && <p className="status-note" style={{ margin: '0 0 12px' }}>{VIEW_GUIDES[view]}</p>}

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
              <div className="list-toolbar">
                <label className="select-all">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
                  Select all {queue.items.length}
                </label>
                <div className="list-toolbar-actions">
                  <button className="btn-quiet" disabled={Boolean(exporting)} onClick={() => exportList('ALL')}>
                    {exporting === 'ALL' ? 'Preparing list…' : 'Export everyone'}
                  </button>
                  {counts.strongFits + counts.closerLook > 0 && (
                    <button className="btn" disabled={Boolean(bulkAction)} onClick={() => setPlannerOpen(true)}>
                      Pick a shortlist…
                    </button>
                  )}
                  {counts.shortlisted > 0 && (
                    <button className="btn btn-primary" disabled={Boolean(exporting)} onClick={() => exportList('SHORTLIST')}>
                      {exporting === 'SHORTLIST' ? 'Preparing shortlist…' : 'Export shortlist'}
                    </button>
                  )}
                </div>
              </div>
              <div className="queue-list">
                {queue.items.map((application) => {
                  const decision = latestDecision(application);
                  const isNext = queue.nextUp?.id === application.id;
                  const bucket = application.score?.bucket;
                  const note = readerNote(application);
                  const name = displayName(application.candidate?.name);
                  const status = application.failureReason
                    ? 'Couldn’t read this file'
                    : matchLabel(application.score) || 'Still reading';
                  return (
                    <div
                      key={application.id}
                      className={`queue-row ${selected.has(application.id) ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${name}`}
                        checked={selected.has(application.id)}
                        onChange={() => toggleSelected(application.id)}
                      />
                      <Link to={`/applications/${application.id}`} state={{ from: returnTo }} className="queue-row-link">
                        <span className={`score-badge ${bucket ? `bucket-${bucket}` : ''}`}>
                          {application.score ? application.score.fitScore : '–'}
                        </span>
                        <span className="queue-who">
                          <span className="queue-name">
                            {name}
                            {isNext && <span className="queue-next-label">Up next</span>}
                          </span>
                          {application.candidate?.email && <span className="queue-email">{application.candidate.email}</span>}
                          {note?.verdict && <span className="queue-note">{note.verdict}</span>}
                          {note?.toCheck && (
                            <span className="queue-note queue-check">
                              <strong>Worth asking:</strong> {note.toCheck}
                            </span>
                          )}
                        </span>
                        <span className="queue-side">
                          {decision ? (
                            <span className="pill is-decision">{DECISION_LABELS[decision]}</span>
                          ) : (
                            status && <span className={`pill ${bucket ? `bucket-${bucket}` : ''}`}>{status}</span>
                          )}
                          <svg className="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>

              {selectedIds.length > 0 && (
                <div className="bulk-bar" role="region" aria-label="Selected candidates">
                  <strong>{selectedIds.length} selected</strong>
                  <button className="btn btn-primary" disabled={Boolean(bulkAction)} onClick={() => decideSelected('SHORTLIST')}>
                    {bulkAction === 'SHORTLIST' ? 'Shortlisting…' : 'Shortlist'}
                  </button>
                  <button className="btn" disabled={Boolean(bulkAction)} onClick={() => decideSelected('REJECT')}>
                    {bulkAction === 'REJECT' ? 'Saving…' : 'Not this time'}
                  </button>
                  <button className="btn btn-danger-solid" disabled={Boolean(bulkAction)} onClick={deleteSelected}>
                    {bulkAction === 'delete' ? 'Deleting…' : 'Delete'}
                  </button>
                  <button className="btn-quiet" onClick={clearSelection}>Clear selection</button>
                </div>
              )}

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
              </div>
            </>
          )}
        </div>
      )}
      {confirmDialog}
      {plannerOpen && (
        <ShortlistPlanner
          jobId={jobId}
          initialLimit={counts.shortlisted + Math.max(1, Math.min(counts.strongFits, 5))}
          onClose={() => setPlannerOpen(false)}
          onShortlisted={finishPlanner}
        />
      )}
    </Layout>
  );
}
