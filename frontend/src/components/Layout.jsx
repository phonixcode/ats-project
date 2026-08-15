import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatPostedDate, userError } from '../lib/format';

export default function Layout({ children }) {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [processMessage, setProcessMessage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [query, setQuery] = useState('');

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

  const filtered = jobs.filter((job) =>
    job.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const currentJob = jobs.find((job) => job.id === jobId);
  const leftoverHere = (currentJob?.processingCount ?? 0) > 0;
  const leftoverAnywhere = jobs.some((job) => job.processingCount > 0);
  const onJobsHome = location.pathname === '/';
  const onReview = Boolean(
    jobId &&
      (location.pathname === `/jobs/${jobId}` || location.pathname === `/jobs/${jobId}/review`),
  );
  const onUpload = location.pathname.includes('/upload');
  const onEdit = location.pathname.includes('/edit');
  const onSettings = location.pathname === '/settings';

  const processRemaining = async (scopeJobId) => {
    const across = scopeJobId ? 'this role' : 'your open roles';
    if (!window.confirm(`Finish the leftover reads for ${across}?`)) return;
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
      <header
        style={{
          borderBottom: '1px solid var(--line)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          background: 'white',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>MG-ATS</h1>
        </Link>
        <span className="muted" style={{ fontSize: 13 }}>
          Every resume gets a real look.
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!onSettings && (
            <Link className="btn-quiet" to="/settings">
              Settings
            </Link>
          )}
          {leftoverAnywhere && onJobsHome && (
            <button className="btn" disabled={processing} onClick={() => processRemaining()}>
              {processing ? 'Starting…' : 'Finish leftover reads'}
            </button>
          )}
          {!onJobsHome && !onSettings && (
            <Link className="btn" to="/jobs/new">
              Post a job
            </Link>
          )}
        </div>
      </header>

      {jobs.length > 0 && (
        <div
          style={{
            borderBottom: '1px solid var(--line)',
            padding: '10px 32px',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            background: 'white',
            flexWrap: 'wrap',
          }}
        >
          <label className="muted" style={{ fontSize: 13 }}>
            Role
            <select
              value={jobId || ''}
              onChange={(e) => {
                if (e.target.value) navigate(`/jobs/${e.target.value}`);
                else navigate('/');
              }}
              style={{ marginLeft: 8, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
            >
              <option value="">All roles</option>
              {filtered.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} · {formatPostedDate(job.postedAt)}
                  {job.unreviewedCount ? ` · ${job.unreviewedCount} to review` : ''}
                </option>
              ))}
            </select>
          </label>
          {jobs.length > 6 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a role"
              style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
            />
          )}
          {jobId && (
            <>
              {!onReview && (
                <Link className="btn" to={`/jobs/${jobId}`}>Review</Link>
              )}
              {!onUpload && (
                <Link className="btn-quiet" to={`/jobs/${jobId}/upload`}>Upload</Link>
              )}
              {!onEdit && (
                <Link className="btn-quiet" to={`/jobs/${jobId}/edit`}>Edit posting</Link>
              )}
              {leftoverHere && (
                <button className="btn-quiet" onClick={() => processRemaining(jobId)} disabled={processing}>
                  {processing ? 'Starting…' : 'Finish leftover'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <main style={{ maxWidth: onJobsHome ? 1100 : 840, margin: '0 auto', padding: '32px' }}>
        {loadError && <div className="error-banner" style={{ marginBottom: 16 }}>{loadError}</div>}
        {processMessage && <p className="muted" style={{ marginTop: 0 }}>{processMessage}</p>}
        {children}
      </main>
    </div>
  );
}
