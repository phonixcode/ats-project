import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { useConfirm } from '../hooks/useConfirm';
import { userError } from '../lib/format';

const emptyForm = {
  title: '',
  postedAt: new Date().toISOString().slice(0, 10),
  location: '',
  workplace: '',
  employmentType: '',
  seniority: '',
  description: '',
};

export default function JobPostingPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(jobId);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [posted, setPosted] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/jobs/${jobId}`)
      .then((res) => {
        const job = res.data;
        setForm({
          title: job.title ?? '',
          postedAt: job.postedAt ? job.postedAt.slice(0, 10) : '',
          location: job.location ?? '',
          workplace: job.workplace ?? '',
          employmentType: job.employmentType ?? '',
          seniority: job.seniority ?? '',
          description: job.description ?? '',
        });
      })
      .catch((err) => setError(userError(err, "We couldn't find that posting.")))
      .finally(() => setLoading(false));
  }, [jobId, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Add a job title and the posting. Spell out the role and who you need — that’s what MG-ATS reads against.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location || undefined,
      workplace: form.workplace || undefined,
      employmentType: form.employmentType || undefined,
      seniority: form.seniority || undefined,
      postedAt: form.postedAt ? new Date(form.postedAt).toISOString() : undefined,
    };
    try {
      if (isEdit) {
        await api.patch(`/jobs/${jobId}`, payload);
        navigate(`/jobs/${jobId}`);
      } else {
        const res = await api.post('/jobs', payload);
        setPosted(res.data);
      }
    } catch (err) {
      setError(userError(err, 'Some required fields are missing. Please complete the highlighted fields.'));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRole = async () => {
    const ok = await confirm({
      title: `Delete “${form.title || 'this role'}”?`,
      message:
        'This removes the role, every candidate and every resume file uploaded to it, to free up space. It can’t be undone — export your shortlist first if you need it.',
      confirmLabel: 'Delete role',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/jobs/${jobId}`);
      navigate('/');
    } catch (err) {
      setError(userError(err, "We couldn't delete this role. Try again."));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <p className="muted">Loading posting…</p>
      </Layout>
    );
  }

  if (posted) {
    return (
      <Layout>
        <h1 className="page-title">Role posted</h1>
        <p className="muted" style={{ margin: '6px 0 20px' }}>Next, upload resumes. MG-ATS does the first read, then you decide who moves on.</p>
        <div className="row">
          <Link className="btn btn-primary" to={`/jobs/${posted.id}/upload`}>Upload resumes</Link>
          <Link className="btn" to={`/jobs/${posted.id}`}>Review</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="page-title">{isEdit ? 'Edit posting' : 'Post a job'}</h1>
      <p className="muted" style={{ margin: '6px 0 24px', maxWidth: 640 }}>
        Write this the way you’d publish it. MG-ATS uses this posting to read each resume — the clearer you are about the role and who you need, the better the notes on each person.
      </p>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="stack" style={{ maxWidth: 720 }}>
        <section className="card stack">
          <h3 style={{ margin: 0 }}>The role</h3>
          <label className="field">
            Job title
            <input required value={form.title} onChange={set('title')} placeholder="e.g. Backend Engineer" />
          </label>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <label className="field" style={{ flex: 1 }}>
              Posted date
              <input type="date" value={form.postedAt} onChange={set('postedAt')} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Location
              <input value={form.location} onChange={set('location')} placeholder="Lagos, or Remote" />
            </label>
          </div>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <label className="field" style={{ flex: 1 }}>
              Workplace
              <select value={form.workplace} onChange={set('workplace')}>
                <option value="">Select</option>
                <option value="ONSITE">On-site</option>
                <option value="HYBRID">Hybrid</option>
                <option value="REMOTE">Remote</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              Employment type
              <select value={form.employmentType} onChange={set('employmentType')}>
                <option value="">Select</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </label>
            <label className="field" style={{ flex: 1 }}>
              Seniority
              <select value={form.seniority} onChange={set('seniority')}>
                <option value="">Select</option>
                <option value="INTERN">Intern</option>
                <option value="JUNIOR">Junior</option>
                <option value="MID">Mid</option>
                <option value="SENIOR">Senior</option>
                <option value="STAFF">Staff+</option>
              </select>
            </label>
          </div>
        </section>

        <section className="card stack">
          <h3 style={{ margin: 0 }}>The posting</h3>
          <label className="field">
            About the role and who you need
            <textarea
              required
              rows={16}
              value={form.description}
              onChange={set('description')}
              placeholder={'About the role\n\nWhat you will do\n- \n- \n\nWho we need\n- \n- \n\nHow we work'}
            />
          </label>
        </section>

        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
          {submitting ? 'Saving…' : isEdit ? 'Save posting' : 'Post job'}
        </button>
      </form>

      {isEdit && (
        <section className="card" style={{ marginTop: 32 }}>
          <h3 style={{ marginTop: 0 }}>Delete this role</h3>
          <p className="muted">
            Removes the role, its candidates, and their resume files to free up space. Your decisions go with it — export the shortlist first if you need it.
          </p>
          <button className="btn btn-danger" type="button" onClick={deleteRole} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete role'}
          </button>
        </section>
      )}
      {confirmDialog}
    </Layout>
  );
}
