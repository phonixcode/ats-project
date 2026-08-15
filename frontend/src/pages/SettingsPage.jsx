import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { userError } from '../lib/format';

const READERS = [
  {
    id: 'builtin',
    label: 'Basic read',
    blurb: 'No key. MG-ATS still reads each resume against your posting — a lighter pass, enough to start deciding.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    field: 'openaiApiKey',
    guideUrl: 'https://platform.openai.com/api-keys',
    guideLabel: 'Get an OpenAI key',
    blurb: 'You choose this reader. Paste your key so MG-ATS can pick up more of each person’s story.',
  },
  {
    id: 'claude',
    label: 'Claude',
    field: 'claudeApiKey',
    guideUrl: 'https://console.anthropic.com/settings/keys',
    guideLabel: 'Get a Claude key',
    blurb: 'You choose this reader. Same job as the others — pick the one you already use.',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    field: 'geminiApiKey',
    guideUrl: 'https://aistudio.google.com/apikey',
    guideLabel: 'Get a Gemini key',
    blurb: 'You choose this reader. Paste your key only for Gemini — the others stay unused until you pick them.',
  },
];

const emptyKeys = { openaiApiKey: '', claudeApiKey: '', geminiApiKey: '' };

function statusLine(using, status) {
  if (using === 'builtin') {
    return 'The next read uses the basic built-in pass. Pick a service below if you want a fuller read.';
  }
  const label = READERS.find((item) => item.id === using)?.label || using;
  const hasKey = status?.[using]?.configured;
  if (!hasKey) {
    return `You picked ${label}. Paste that key and save — until then MG-ATS uses the basic read.`;
  }
  return `You’re using ${label}. Open a candidate and tap Read again if they already have a score.`;
}

export default function SettingsPage() {
  const [status, setStatus] = useState(null);
  const [picked, setPicked] = useState('builtin');
  const [keys, setKeys] = useState(emptyKeys);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const applyStatus = (data) => {
    setStatus(data);
    setPicked(data.using || 'builtin');
  };

  useEffect(() => {
    api
      .get('/settings')
      .then((res) => {
        applyStatus(res.data);
        setError(null);
      })
      .catch((err) => setError(userError(err, 'We couldn’t load settings. Try again.')))
      .finally(() => setLoading(false));
  }, []);

  const selected = READERS.find((item) => item.id === picked);
  const selectedSaved = selected?.id !== 'builtin' ? status?.[selected.id] : null;

  const save = async (e) => {
    e.preventDefault();
    const payload = { reader: picked };
    if (selected?.field) {
      const value = keys[selected.field].trim();
      if (value) payload[selected.field] = value;
      else if (!selectedSaved?.configured) {
        setError(`Paste a ${selected.label} key, or pick Basic read.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.put('/settings', payload);
      applyStatus(res.data);
      setKeys(emptyKeys);
      setNotice(
        picked === 'builtin'
          ? 'Saved. The next read uses the basic pass.'
          : `Saved. You’re using ${selected.label}. Keys stay on this PC.`,
      );
    } catch (err) {
      setError(userError(err, 'We couldn’t save your choice. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async (field) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.put('/settings', { reader: 'builtin', [field]: '' });
      applyStatus(res.data);
      setKeys((prev) => ({ ...prev, [field]: '' }));
      setNotice('Key removed. The next read uses the basic pass until you pick a service again.');
    } catch (err) {
      setError(userError(err, 'We couldn’t update settings. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <Link to="/" className="muted" style={{ textDecoration: 'none', fontSize: 14 }}>
        ← All roles
      </Link>
      <h2 className="page-title" style={{ marginTop: 12, marginBottom: 8 }}>
        Who should read the resumes?
      </h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 24, maxWidth: 640 }}>
        You pick the service. MG-ATS only uses that one. A key is optional — Basic read still works. Keys stay on this PC.
      </p>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="success-banner" style={{ marginBottom: 16 }}>{notice}</div>}

      {loading ? (
        <p className="muted">Loading settings…</p>
      ) : (
        <form onSubmit={save} className="stack" style={{ maxWidth: 640 }}>
          <p className="card" style={{ margin: 0 }}>
            {statusLine(picked, status)}
          </p>
          {READERS.map((reader) => {
            const active = picked === reader.id;
            return (
              <button
                key={reader.id}
                type="button"
                className={`reader-card ${active ? 'is-selected' : ''}`}
                onClick={() => {
                  setPicked(reader.id);
                  setError(null);
                }}
              >
                <span className="reader-card-pick">{active ? 'Using' : 'Use'}</span>
                <span>
                  <strong>{reader.label}</strong>
                  <span className="muted" style={{ display: 'block', marginTop: 6, fontWeight: 400 }}>
                    {reader.blurb}
                  </span>
                </span>
              </button>
            );
          })}

          {selected?.field && (
            <section className="card stack">
              <p style={{ margin: 0, fontSize: 14 }}>
                Paste your {selected.label} key.{' '}
                <a className="help-link" href={selected.guideUrl} target="_blank" rel="noreferrer">
                  {selected.guideLabel}
                </a>
                {' '}— create an account, then copy the key. You don’t need the other services.
              </p>
              <label className="field">
                {selected.label} key
                {selectedSaved?.configured && (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    Saved {selectedSaved.hint}
                  </span>
                )}
                <input
                  type="password"
                  autoComplete="off"
                  value={keys[selected.field]}
                  onChange={(e) => setKeys((prev) => ({ ...prev, [selected.field]: e.target.value }))}
                  placeholder={selectedSaved?.configured ? 'Paste a new key to replace' : 'Paste key'}
                />
              </label>
              {selectedSaved?.configured && (
                <button
                  type="button"
                  className="btn-quiet"
                  disabled={saving}
                  onClick={() => removeKey(selected.field)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Remove this key
                </button>
              )}
            </section>
          )}

          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : picked === 'builtin' ? 'Use the basic read' : `Use ${selected?.label}`}
            </button>
          </div>
        </form>
      )}
    </Layout>
  );
}
