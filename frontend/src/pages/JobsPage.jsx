import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { downloadJobExport } from '../lib/export';
import Layout from '../components/Layout';
import Menu from '../components/Menu';
import PageHeader from '../components/PageHeader';
import { useConfirm } from '../hooks/useConfirm';
import {
  attentionLine,
  formatPostedDate,
  greeting,
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
  const [confirm, confirmDialog] = useConfirm();

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

  const deleteRole = async (job) => {
    const ok = await confirm({
      title: `Delete “${job.title}”?`,
      message: `This removes the role${job.applicationCount ? `, its ${job.applicationCount} candidate${job.applicationCount === 1 ? '' : 's'} and their resume files` : ''}, to free up space. It can’t be undone — export the shortlist first if you need it.`,
      confirmLabel: 'Delete role',
      tone: 'danger',
    });
    if (!ok) return;
    setExportError(null);
    setExportNotice(null);
    try {
      await api.delete(`/jobs/${job.id}`);
      setExportNotice(`Deleted ${job.title}.`);
      loadJobs();
    } catch (err) {
      setExportError(userError(err, "We couldn't delete that role. Try again."));
    }
  };

  return (
    <Layout>
      <div className="welcome">
        <h1>{greeting()}</h1>
        <p>{loading ? 'Getting your roles ready…' : attentionLine(jobs)}</p>
      </div>
      <PageHeader
        title="Your roles"
        actions={
          <label className="row muted" style={{ fontSize: 14 }}>
            Posted
            <select className="role-switch" value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="all">Any time</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="custom">Custom dates</option>
            </select>
          </label>
        }
      />
      {range === 'custom' && (
        <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <label className="field" style={{ width: 180 }}>
            From
            <input type="date" value={postedFrom} onChange={(e) => setPostedFrom(e.target.value)} />
          </label>
          <label className="field" style={{ width: 180 }}>
            To
            <input type="date" value={postedTo} onChange={(e) => setPostedTo(e.target.value)} />
          </label>
        </div>
      )}

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
      {exportError && <div className="error-banner" style={{ marginBottom: 16 }}>{exportError}</div>}
      {exportNotice && <div className="success-banner" style={{ marginBottom: 16 }}>{exportNotice}</div>}

      {loading ? (
        <p className="muted">Loading roles…</p>
      ) : jobs.length === 0 ? (
        <div className="empty">
          <h2 style={{ fontSize: 20, margin: '0 0 6px', color: 'var(--ink)' }}>Post your first role</h2>
          <p style={{ margin: 0 }}>Describe the job, upload resumes, and MG-ATS does the first read against it.</p>
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-primary" to="/jobs/new">Post a job</Link>
          </div>
        </div>
      ) : (
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Posted</th>
              <th>Candidates</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <Link className="role-title" to={`/jobs/${job.id}`}>{job.title}</Link>
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {[job.location, WORKPLACE_LABELS[job.workplace]].filter(Boolean).join(', ') || 'No location set'}
                    {job.status && job.status !== 'open' ? ` (${job.status})` : ''}
                  </div>
                </td>
                <td className="muted">{formatPostedDate(job.postedAt)}</td>
                <td>
                  {job.applicationCount > 0 ? (
                    <>
                      <span className="count-strong">{job.unreviewedCount || 0}</span>{' '}
                      <span className="muted">to review</span>
                      {job.shortlistedCount > 0 && (
                        <div className="muted" style={{ fontSize: 13 }}>{job.shortlistedCount} shortlisted</div>
                      )}
                    </>
                  ) : (
                    <span className="muted">No resumes yet</span>
                  )}
                </td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    {job.applicationCount > 0 ? (
                      <Link className="btn" to={`/jobs/${job.id}`}>Review</Link>
                    ) : (
                      <Link className="btn" to={`/jobs/${job.id}/upload`}>Upload resumes</Link>
                    )}
                    <Menu
                      label={`More actions for ${job.title}`}
                      items={[
                        { key: 'upload', label: 'Upload resumes', to: `/jobs/${job.id}/upload` },
                        { key: 'edit', label: 'Edit posting', to: `/jobs/${job.id}/edit` },
                        ...(job.shortlistedCount > 0
                          ? [{
                              key: 'export',
                              label: exportingId === job.id ? 'Preparing shortlist…' : 'Export shortlist',
                              onSelect: () => exportShortlist(job),
                            }]
                          : []),
                        { key: 'divider', divider: true },
                        { key: 'delete', label: 'Delete role', danger: true, onSelect: () => deleteRole(job) },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {confirmDialog}
    </Layout>
  );
}
