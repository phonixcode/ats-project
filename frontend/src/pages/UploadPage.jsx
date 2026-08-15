import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { formatPostedDate, userError } from '../lib/format';

export default function UploadPage() {
  const { jobId } = useParams();
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const [job, setJob] = useState(null);
  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/jobs/${jobId}`)
      .then((res) => setJob(res.data))
      .catch((err) => setError(userError(err, "We couldn't load this role.")));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setBatch(null);
    setError(null);
  };

  const startPolling = (batchId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/batches/${batchId}`, {
          params: { _t: Date.now() },
        });
        setBatch(res.data);
        if (res.data.status !== 'PROCESSING') {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        setError(userError(err, "We couldn't check progress. Refresh and try again."));
        clearInterval(pollRef.current);
      }
    }, 2000);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('jobId', jobId);
    try {
      const res = await api.post('/batches/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBatch(res.data);
      startPolling(res.data.id);
    } catch (err) {
      setError(userError(err, 'We couldn’t upload that file. Check it’s a .zip and try again.'));
    } finally {
      setUploading(false);
    }
  };

  const progressPct =
    batch && batch.totalFiles > 0
      ? Math.round((batch.processedCount / batch.totalFiles) * 100)
      : 0;

  const statusCopy = {
    PROCESSING: 'MG-ATS is reading each resume against the posting. This can take a few minutes.',
    COMPLETED: 'First read is done. Open Review and make your calls.',
    COMPLETED_WITH_ERRORS: 'First read is done — a few files couldn’t be opened. Everything else is ready for you.',
    FAILED: 'None of the files could be opened. Check the zip and try again.',
  };

  return (
    <Layout>
      <Link to="/" className="muted" style={{ fontSize: 14, textDecoration: 'none' }}>← All roles</Link>
      <h2 className="page-title" style={{ marginTop: 12 }}>
        Upload resumes{job ? ` · ${job.title}` : ''}
      </h2>
      <p className="muted" style={{ marginTop: 6 }}>
        {job ? `Posted ${formatPostedDate(job.postedAt)}. ` : ''}
        Choose a .zip of PDF or Word resumes. MG-ATS reads each file against this posting, then you make the call.
      </p>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      {!batch && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="empty"
          style={{ cursor: 'pointer', background: 'white' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {file ? (
            <p><strong>{file.name}</strong> selected</p>
          ) : (
            <p>Click to choose a .zip of resumes</p>
          )}
        </div>
      )}

      {file && !batch && (
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Read these resumes'}
        </button>
      )}

      {batch && (
        <div className="card" style={{ marginTop: 8 }}>
          <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: batch.failedCount > 0 ? 'var(--needs-review)' : 'var(--strong-fit)',
              }}
            />
          </div>
          <p className="mono muted" style={{ fontSize: 13, margin: 0 }}>
            {batch.processedCount} of {batch.totalFiles || '…'} read
            {batch.failedCount > 0 && ` · ${batch.failedCount} couldn't be read`}
          </p>
          <p>{statusCopy[batch.status] || 'Working on it…'}</p>
          {batch.status !== 'PROCESSING' && (
            <Link className="btn btn-ink" to={`/jobs/${jobId}`}>Start reviewing →</Link>
          )}
        </div>
      )}
    </Layout>
  );
}
