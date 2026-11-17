import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { userError } from '../lib/format';
import { useConfirm } from '../hooks/useConfirm';

export default function Layout({ children }) {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [processMessage, setProcessMessage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const loadJobs = () =>
    api
      .get('/jobs')
      .then((res) => {
        setJobs(res.data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(userError(err, 'We couldn’t load your roles. Try again.')));

  useEffect(() => {
    loadJobs();
  }, [location.pathname]);

  const currentJob = jobs.find((job) => job.id === jobId);
  const leftoverHere = (currentJob?.processingCount ?? 0) > 0;
  const leftoverAnywhere = jobs.some((job) => job.processingCount > 0);
  const path = location.pathname;
  const onJobsHome = path === '/';
  const onReview = Boolean(jobId && (path === `/jobs/${jobId}` || path === `/jobs/${jobId}/review`));
  const onUpload = path.endsWith('/upload');
  const onEdit = path.endsWith('/edit');
  const onSettings = path === '/settings';
  const onNewJob = path === '/jobs/new';
  const narrow = onEdit || onNewJob || onUpload || onSettings;

  const processRemaining = async (scopeJobId) => {
    const across = scopeJobId ? 'this role' : 'your open roles';
    const ok = await confirm({
      title: 'Finish leftover reads?',
      message: `MG-ATS picks up every resume for ${across} that hasn’t been fully read yet. It can take a few minutes.`,
      confirmLabel: 'Finish reads',
    });
    if (!ok) return;
    setProcessing(true);
    setProcessMessage(null);
    try {
      const res = await api.post('/jobs/process-remaining', {
        jobId: scopeJobId || undefined,
      });
      setProcessMessage(
        res.data.queued
          ? `Started ${res.data.queued} leftover read${res.data.queued === 1 ? '' : 's'}. This can take a few minutes.`
          : 'Nothing left to read.',
      );
      loadJobs();
    } catch (err) {
      setProcessMessage(userError(err, 'We couldn’t start those leftover reads. Try again.'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="brand" aria-label="MG-ATS home">
            <span className="brand-mark" aria-hidden="true">MG</span>
            <span className="brand-name">
              <strong>MG-ATS</strong>
              <span>Morgen Green recruiting</span>
            </span>
          </Link>
          <nav className="app-nav" aria-label="Main">
            <Link to="/" className={!onSettings ? 'is-active' : ''}>Roles</Link>
            <Link to="/settings" className={onSettings ? 'is-active' : ''}>Settings</Link>
          </nav>
          <div className="app-header-actions">
            {leftoverAnywhere && onJobsHome && (
              <button className="btn" disabled={processing} onClick={() => processRemaining()}>
                {processing ? 'Starting…' : 'Finish leftover reads'}
              </button>
            )}
            {!onNewJob && (
              <Link className="btn btn-primary" to="/jobs/new">Post a job</Link>
            )}
          </div>
        </div>
      </header>

      {jobId && currentJob && (
        <div className="role-bar">
          <div className="role-bar-inner">
            <select
              className="role-switch"
              aria-label="Switch role"
              value={jobId}
              onChange={(e) => navigate(`/jobs/${e.target.value}`)}
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                  {job.unreviewedCount ? ` (${job.unreviewedCount} to review)` : ''}
                </option>
              ))}
            </select>
            <nav className="role-tabs" aria-label="Role">
              <Link to={`/jobs/${jobId}`} className={onReview ? 'is-active' : ''}>Review</Link>
              <Link to={`/jobs/${jobId}/upload`} className={onUpload ? 'is-active' : ''}>Upload resumes</Link>
              <Link to={`/jobs/${jobId}/edit`} className={onEdit ? 'is-active' : ''}>Edit posting</Link>
            </nav>
            {leftoverHere && (
              <div className="role-bar-actions">
                <button className="btn" onClick={() => processRemaining(jobId)} disabled={processing}>
                  {processing ? 'Starting…' : 'Finish leftover reads'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <main className={`app-main ${narrow ? 'is-narrow' : ''}`}>
        {loadError && <div className="error-banner" style={{ marginBottom: 16 }}>{loadError}</div>}
        {processMessage && <div className="success-banner" style={{ marginBottom: 16 }}>{processMessage}</div>}
        {children}
      </main>
      {confirmDialog}
    </div>
  );
}
