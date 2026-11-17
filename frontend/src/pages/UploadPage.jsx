import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { formatPostedDate, userError } from '../lib/format';

const ACCEPTED_EXTENSIONS = ['.zip', '.pdf', '.doc', '.docx'];

function isAccepted(file) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function UploadPage() {
  const { jobId } = useParams();
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const [job, setJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [batch, setBatch] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
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

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList);
    const rejected = incoming.filter((f) => !isAccepted(f));
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      const fresh = incoming.filter((f) => isAccepted(f) && !seen.has(`${f.name}:${f.size}`));
      return [...current, ...fresh];
    });
    setBatch(null);
    setError(
      rejected.length
        ? `Skipped ${rejected.map((f) => f.name).join(', ')}. Only .zip, PDF and Word files can be read.`
        : null,
    );
  };

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (index) => {
    setFiles((current) => current.filter((_, i) => i !== index));
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
    if (files.length === 0) return;
    setUploading(true);
    setUploadPct(0);
    setError(null);
    const formData = new FormData();
    formData.append('jobId', jobId);
    files.forEach((f) => formData.append('files', f));
    try {
      const res = await api.post('/batches/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });
      setBatch(res.data);
      startPolling(res.data.id);
    } catch (err) {
      setError(userError(err, 'We couldn’t upload those files. Check they’re .zip, PDF or Word files and try again.'));
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
    FAILED: 'None of the files could be opened. Check the files and try again.',
  };

  return (
    <Layout>
      <h1 className="page-title">Upload resumes</h1>
      <p className="muted" style={{ margin: '6px 0 20px', maxWidth: 640 }}>
        {job ? `Posted ${formatPostedDate(job.postedAt)}. ` : ''}
        Drop a .zip, or PDF and Word resumes — one or many. MG-ATS reads each file against this posting, then you make the call.
      </p>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      {!batch && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => (uploading ? e.preventDefault() : handleDrop(e))}
          className="empty"
          style={{
            cursor: uploading ? 'default' : 'pointer',
            background: dragging ? 'var(--accent-soft)' : 'white',
            borderColor: dragging ? 'var(--accent)' : undefined,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <p style={{ margin: 0 }}>
            {dragging ? 'Drop to add these files' : 'Drag files here, or click to choose'}
          </p>
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>.zip, PDF or Word · one or many</p>
        </div>
      )}

      {files.length > 0 && !batch && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="mono muted" style={{ fontSize: 13, marginTop: 0 }}>
            {files.length} file{files.length === 1 ? '' : 's'} ·{' '}
            {formatSize(files.reduce((sum, f) => sum + f.size, 0))}
          </p>
          <div className="stack" style={{ gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {files.map((f, index) => (
              <div key={`${f.name}:${f.size}`} className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span className="row">
                  <span className="mono muted" style={{ fontSize: 12 }}>{formatSize(f.size)}</span>
                  <button className="btn-quiet" onClick={() => removeFile(index)} disabled={uploading}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && !batch && (
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleUpload} disabled={uploading}>
          {uploading ? `Uploading… ${uploadPct}%` : 'Read these resumes'}
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
            <Link className="btn btn-primary" to={`/jobs/${jobId}`}>Start reviewing</Link>
          )}
        </div>
      )}
    </Layout>
  );
}
