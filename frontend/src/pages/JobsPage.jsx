import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { downloadJobExport } from '../lib/export';
import Layout from '../components/Layout';
import {
  formatPostedDate,
  userError,
  WORKPLACE_LABELS,
} from '../lib/format';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('all');
  const [postedFrom, setPostedFrom] = useState('');
  const [postedTo, setPostedTo] = useState('');
  const [exportingId, setExportingId] = useState(null);
  const [exportNotice, setExportNotice] = useState(null);
  const [exportError, setExportError] = useState(null);

  const paramsForRange = () => {
    const now = new Date();
    if (range === 'week') {
      const from = new Date(now);
      from.setDate(now.getDate() - 7);
      return { postedFrom: from.toISOString() };
    }
    if (range === 'month') {
      const from = new Date(now);
      from.setMonth(now.getMonth() - 1);
      return { postedFrom: from.toISOString() };
    }
    if (range === 'custom') {
      return {
        postedFrom: postedFrom ? new Date(postedFrom).toISOString() : undefined,
        postedTo: postedTo ? new Date(`${postedTo}T23:59:59`).toISOString() : undefined,
      };
    }
    return {};
  };

  const loadJobs = () => {
    setLoading(true);
    api
      .get('/jobs', { params: paramsForRange() })
      .then((res) => {
        setJobs(res.data);
        setError(null);
      })
      .catch((err) => setError(userError(err, 'We couldn’t load your roles. Try again.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJobs();
  }, [range, postedFrom, postedTo]);

  const exportShortlist = async (job) => {
    setExportingId(job.id);
    setExportError(null);
    setExportNotice(null);
    try {
      await downloadJobExport(job.id, 'SHORTLIST');
      setExportNotice(`Downloaded the shortlist for ${job.title}.`);
    } catch (err) {
      setExportError(userError(err, "We couldn't export that shortlist. Try again."));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <Layout>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 className="page-title">Roles</h2>
        <Link className="btn btn-primary" to="/jobs/new">Post a job</Link>
      </div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
        Post a role, upload a zip, then work the pile. MG-ATS reads each resume so you can shortlist faster.
      </p>

      <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <label className="muted" style={{ fontSize: 13 }}>
          Posted
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{ marginLeft: 8, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
          >
            <option value="all">Any time</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
        {range === 'custom' && (
          <>
            <input type="date" value={postedFrom} onChange={(e) => setPostedFrom(e.target.value)} />
            <input type="date" value={postedTo} onChange={(e) => setPostedTo(e.target.value)} />
          </>
        )}
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
      {exportError && <div className="error-banner" style={{ marginBottom: 16 }}>{exportError}</div>}
      {exportNotice && <div className="success-banner" style={{ marginBottom: 16 }}>{exportNotice}</div>}

      {loading ? (
        <p className="muted">Loading roles…</p>
      ) : jobs.length === 0 ? (
        <div className="empty">
          No roles yet. Post a job, then upload resumes — MG-ATS handles the first read.
          <div style={{ marginTop: 14 }}>
            <Link className="btn btn-primary" to="/jobs/new">Post a job</Link>
          </div>
        </div>
      ) : (
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Posted</th>
              <th>Role</th>
              <th>Location</th>
              <th>Waiting</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="mono" style={{ fontSize: 12 }}>{formatPostedDate(job.postedAt)}</td>
                <td>
                  <Link to={`/jobs/${job.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                    {job.title}
                  </Link>
                </td>
                <td className="muted">
                  {job.location || '—'}
                  {job.workplace ? ` · ${WORKPLACE_LABELS[job.workplace]}` : ''}
                </td>
                <td style={{ fontSize: 13 }}>
                  {job.unreviewedCount > 0
                    ? `${job.unreviewedCount} to review`
                    : job.shortlistedCount > 0
                      ? `${job.shortlistedCount} shortlisted`
                      : job.applicationCount > 0
                        ? `${job.applicationCount} in`
                        : 'No resumes yet'}
                </td>
                <td>{job.status === 'open' ? 'Open' : job.status}</td>
                <td>
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <Link className="btn btn-primary" to={`/jobs/${job.id}`}>Review</Link>
                    <Link className="btn-quiet" to={`/jobs/${job.id}/upload`}>Upload</Link>
                    {job.shortlistedCount > 0 && (
                      <button
                        className="btn-quiet"
                        disabled={exportingId === job.id}
                        onClick={() => exportShortlist(job)}
                      >
                        {exportingId === job.id ? 'Preparing…' : 'Export shortlist'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
}
