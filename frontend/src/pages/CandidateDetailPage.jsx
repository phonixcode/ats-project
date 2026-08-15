import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  BUCKET_LABELS,
  DECISION_LABELS,
  formatPostedDate,
  userError,
} from '../lib/format';

const CATEGORY_LABELS = {
  VERIFY_CLAIM: 'Verify a claim',
  PROBE_GAP: 'Worth asking about',
  EXPLORE_STRENGTH: 'Dig into a strength',
  AUTHENTICITY_CHECK: 'Personal detail check',
};

const REVIEW_MESSAGES = {
  SHORTLIST: 'Shortlisted. Export this list from the review board when you’re ready.',
  MAYBE: 'Saved as maybe later. You can change this anytime.',
  REJECT: 'Marked as not this time. You can change this anytime.',
};

export default function CandidateDetailPage() {
  const { applicationId } = useParams();
  const pollRef = useRef(null);
  const [app, setApp] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [reviewMessage, setReviewMessage] = useState(null);
  const [note, setNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [showPosting, setShowPosting] = useState(false);
  const [showResume, setShowResume] = useState(false);

  const load = () => {
    return api
      .get(`/applications/${applicationId}`)
      .then((res) => {
        setApp(res.data);
        setError(null);
        return res.data;
      })
      .catch((err) => {
        setError(userError(err, "We couldn't find that application."));
        return null;
      });
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/applications/${applicationId}`)
      .then((res) => {
        if (cancelled) return;
        setApp(res.data);
        setError(null);
        setReviewMessage(null);
        setActionError(null);
        setScoring(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(userError(err, "We couldn't find that application."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const scoringInProgress = scoring || app?.status === 'SCORING';

  useEffect(() => {
    if (!applicationId || !scoringInProgress) return undefined;
    if (pollRef.current) clearInterval(pollRef.current);
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/applications/${applicationId}`, {
          params: { _t: Date.now() },
        });
        setApp(res.data);
        if (res.data.status !== 'SCORING') {
          setScoring(false);
          clearInterval(pollRef.current);
          pollRef.current = null;
        } else if (Date.now() - started > 90000) {
          setActionError(
            'Scoring is taking longer than expected. Stay on this page, or try again in a moment.',
          );
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (err) {
        setActionError(userError(err, "We couldn't check progress. Refresh and try again."));
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 2000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [applicationId, scoringInProgress]);

  const submitReview = async (decision) => {
    setSubmittingReview(true);
    setActionError(null);
    setReviewMessage(null);
    try {
      await api.post(`/applications/${applicationId}/reviews`, {
        humanDecision: decision,
        note: note || undefined,
      });
      setNote('');
      setReviewMessage(REVIEW_MESSAGES[decision]);
      await load();
    } catch (err) {
      setActionError(userError(err, "We couldn't save your call. Try again."));
    } finally {
      setSubmittingReview(false);
    }
  };

  const generateQuestions = async () => {
    setGeneratingQuestions(true);
    setActionError(null);
    try {
      await api.post(`/applications/${applicationId}/interview-questions`);
      await load();
    } catch (err) {
      setActionError(userError(err, "We couldn't write interview questions. Try again."));
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const scoreAgain = async () => {
    setScoring(true);
    setActionError(null);
    try {
      await api.post(`/applications/${applicationId}/rescore`);
      await load();
    } catch (err) {
      setActionError(userError(err, "We couldn't start scoring. Try again."));
      setScoring(false);
    }
  };

  if (!app || app.id !== applicationId) {
    if (error) {
      return (
        <Layout>
          <div className="error-banner">{error}</div>
          <Link to="/" className="btn" style={{ marginTop: 16 }}>Back to roles</Link>
        </Layout>
      );
    }
    return (
      <Layout>
        <p className="muted">Loading candidate…</p>
      </Layout>
    );
  }

  if (error || !app) {
    return (
      <Layout>
        <div className="error-banner">{error || "We couldn't find that application."}</div>
        <Link to="/" className="btn" style={{ marginTop: 16 }}>Back to roles</Link>
      </Layout>
    );
  }

  const score = app.score;
  const latestReview = app.reviews?.[app.reviews.length - 1];
  const scoringFailed =
    !score &&
    !app.failureReason &&
    (app.status === 'PENDING_REVIEW' || app.status === 'SCORE_FAILED');
  const resumeName = app.rawFilePath?.split('/').pop();

  return (
    <Layout>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Link to={`/jobs/${app.jobId}`} className="muted" style={{ fontSize: 14, textDecoration: 'none' }}>
          ← Back to {app.job?.title || 'review board'}
        </Link>
        <div className="row">
          {app.previousId && <Link className="btn" to={`/applications/${app.previousId}`}>Previous</Link>}
          {app.nextId && <Link className="btn" to={`/applications/${app.nextId}`}>Next</Link>}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
        <div>
          <h2 className="page-title" style={{ fontSize: 30 }}>{app.candidate?.name || 'Unnamed candidate'}</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            {app.candidate?.email && (
              <a href={`mailto:${app.candidate.email}`}>{app.candidate.email}</a>
            )}
            {app.candidate?.email && app.candidate?.phone ? ' · ' : ''}
            {app.candidate?.phone && (
              <a href={`tel:${app.candidate.phone}`}>{app.candidate.phone}</a>
            )}
          </p>
          {app.job && (
            <p className="muted" style={{ fontSize: 13 }}>
              {app.job.title} · Posted {formatPostedDate(app.job.postedAt)}
            </p>
          )}
        </div>
        {score && (
          <div className="score-stamp">
            <p className="score-stamp-num">{score.fitScore}</p>
            <p className="score-stamp-label">{BUCKET_LABELS[score.bucket]}</p>
          </div>
        )}
      </div>

      {actionError && <div className="error-banner" style={{ margin: '16px 0' }}>{actionError}</div>}
      {reviewMessage && (
        <div className="success-banner" style={{ margin: '16px 0' }}>
          {reviewMessage}{' '}
          {latestReview?.humanDecision === 'SHORTLIST' && (
            <Link to={`/jobs/${app.jobId}`}>Go to the review board</Link>
          )}
        </div>
      )}

      {app.failureReason && (
        <div className="error-banner" style={{ margin: '16px 0' }}>
          We couldn’t read this resume. Check the file and try again, or make your call without a score.
        </div>
      )}

      {scoringFailed && (
        <div className="error-banner" style={{ margin: '16px 0' }}>
          We couldn’t score this resume. Try scoring again, or make your call without it.
        </div>
      )}

      {scoringInProgress && (
        <div className="success-banner" style={{ margin: '16px 0' }}>
          Scoring this candidate… This usually takes a few seconds. You can keep reading while we work.
        </div>
      )}

      {latestReview && !reviewMessage && (
        <div className="card" style={{ background: 'var(--accent-soft)', margin: '16px 0' }}>
          Your call: <strong>{DECISION_LABELS[latestReview.humanDecision] || latestReview.humanDecision}</strong>
          {latestReview.note && <span className="muted"> — “{latestReview.note}”</span>}
          {latestReview.humanDecision === 'SHORTLIST' && (
            <p className="status-note">
              Export this list from the <Link to={`/jobs/${app.jobId}`}>review board</Link>.
            </p>
          )}
        </div>
      )}

      <div className="row" style={{ margin: '16px 0', flexWrap: 'wrap' }}>
        <button
          className="btn btn-ink"
          onClick={scoreAgain}
          disabled={scoringInProgress || !app.parsedJson}
        >
          {scoringInProgress ? 'Scoring this candidate…' : score ? 'Score again' : 'Score this candidate'}
        </button>
        <button className="btn" onClick={() => setShowPosting((value) => !value)}>
          {showPosting ? 'Hide posting' : 'This posting'}
        </button>
        {app.rawResumeText && (
          <button className="btn" onClick={() => setShowResume((value) => !value)}>
            {showResume ? 'Hide resume' : 'Resume text'}
          </button>
        )}
        {resumeName && <span className="chip">{resumeName}</span>}
      </div>
      {!app.parsedJson && (
        <p className="status-note">We still need to read the resume before we can score it.</p>
      )}

      {showPosting && app.job && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>{app.job.title}</h3>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            {app.job.description}
          </p>
        </div>
      )}

      {showResume && app.rawResumeText && (
        <pre className="card" style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, maxHeight: 320, overflow: 'auto' }}>
          {app.rawResumeText}
        </pre>
      )}

      {score && (
        <div style={{ margin: '8px 0 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }} className="judge-grid">
            <div className="card">
              <h3 style={{ fontSize: 15, marginTop: 0, color: 'var(--strong-fit)' }}>What stands out</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                {(score.fitRationaleJson?.strengths || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 style={{ fontSize: 15, marginTop: 0, color: 'var(--needs-review)' }}>Worth asking about</h3>
              {(score.fitRationaleJson?.gaps || []).length === 0 ? (
                <p className="muted" style={{ fontSize: 14, fontStyle: 'italic', margin: 0 }}>
                  Nothing notable — a clean match on paper.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
                  {score.fitRationaleJson.gaps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {score.fitRationaleJson?.summary && (
            <div className="card" style={{ marginBottom: 0 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{score.fitRationaleJson.summary}</p>
            </div>
          )}
        </div>
      )}

      {score?.authenticityReasoning && (
        <div className="card" style={{ marginBottom: 28, fontSize: 13 }}>
          <strong>How this reads: </strong>
          <span style={{ textTransform: 'lowercase' }}>{score.authenticitySignal}</span>
          <span className="muted"> — {score.authenticityReasoning}</span>
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 17 }}>Your decision</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          You can make this call even if scoring didn’t finish.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any notes for yourself (optional)"
          rows={2}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginBottom: 10, resize: 'vertical' }}
        />
        <div className="row">
          <button className="btn" style={{ background: 'var(--strong-fit)', color: 'white', borderColor: 'var(--strong-fit)' }} onClick={() => submitReview('SHORTLIST')} disabled={submittingReview}>
            {submittingReview ? 'Saving…' : 'Shortlist'}
          </button>
          <button className="btn" onClick={() => submitReview('MAYBE')} disabled={submittingReview}>
            Maybe later
          </button>
          <button className="btn btn-danger" onClick={() => submitReview('REJECT')} disabled={submittingReview}>
            Not this time
          </button>
        </div>
      </div>

      {score && (
        <div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, margin: 0 }}>Interview questions</h3>
            <button className="btn btn-ink" onClick={generateQuestions} disabled={generatingQuestions}>
              {generatingQuestions ? 'Writing questions…' : app.interviewQuestions?.length ? 'Write new questions' : 'Write interview questions'}
            </button>
          </div>
          {app.interviewQuestions?.length > 0 && (
            <div className="stack">
              {app.interviewQuestions.map((question) => (
                <div key={question.id} className="card">
                  <p className="mono" style={{ fontSize: 11, color: 'var(--accent)', margin: '0 0 6px', textTransform: 'uppercase' }}>
                    {CATEGORY_LABELS[question.category]}
                  </p>
                  <p style={{ margin: 0, fontSize: 15 }}>{question.questionText}</p>
                  <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                    grounded in: {question.groundedIn}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
