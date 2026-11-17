import { useEffect } from 'react';
import { displayName, matchLabel } from '../lib/format';
import { useShortlistPlan } from '../hooks/useShortlistPlan';

function PlanRow({ person, checked, onToggle, reason }) {
  return (
    <label className="plan-row">
      <input type="checkbox" checked={checked} onChange={() => onToggle(person.id)} />
      <span className={`score-badge bucket-${person.bucket}`}>{Math.round(person.score)}</span>
      <span className="plan-row-text">
        <strong>{displayName(person.name)}</strong>
        <span className="muted"> · {matchLabel({ fitScore: person.score, bucket: person.bucket })}</span>
        {reason && <span className="plan-row-reason">{reason}</span>}
        {person.worthAsking && (
          <span className="queue-note queue-check">
            <strong>Worth asking:</strong> {person.worthAsking}
          </span>
        )}
      </span>
    </label>
  );
}

export default function ShortlistPlanner({ jobId, initialLimit, onClose, onShortlisted }) {
  const { limit, setLimit, plan, chosen, toggle, loading, error, saving, shortlistChosen } = useShortlistPlan(
    jobId,
    initialLimit,
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    const count = await shortlistChosen();
    if (count !== null) onShortlisted(count);
  };

  const openSlots = plan ? Math.max(0, plan.limit - plan.alreadyShortlisted) : 0;

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="planner-title">
        <h3 id="planner-title" className="dialog-title">Pick a shortlist</h3>
        <label className="field planner-limit">
          How many people do you want to interview?
          <input
            type="number"
            min={1}
            max={1000}
            value={Number.isNaN(limit) ? '' : limit}
            onChange={(e) => setLimit(e.target.valueAsNumber)}
            autoFocus
          />
        </label>
        {plan && (
          <p className="muted planner-status">
            {plan.alreadyShortlisted > 0 && `${plan.alreadyShortlisted} already shortlisted. `}
            {openSlots > 0
              ? `MG-ATS picked the top ${plan.picks.length} undecided good match${plan.picks.length === 1 ? '' : 'es'} by score. Untick anyone you’d rather not.`
              : 'Your shortlist is already that size. Raise the number to add more.'}
          </p>
        )}

        <div className="planner-body">
          {error && <div className="error-banner">{error}</div>}
          {loading && !plan && <p className="muted">Working out the shortlist…</p>}
          {plan && (
            <>
              {plan.picks.length > 0 ? (
                <section>
                  <h4 className="planner-heading">Top picks</h4>
                  {plan.picks.map((person) => (
                    <PlanRow key={person.id} person={person} checked={chosen.has(person.id)} onToggle={toggle} />
                  ))}
                </section>
              ) : (
                openSlots > 0 && <p className="muted">No undecided good matches left for this role.</p>
              )}
              {plan.secondLook.length > 0 && (
                <section>
                  <h4 className="planner-heading">Worth a second look</h4>
                  <p className="muted planner-hint">
                    Not picked for you. Everyone deserves a fair read — tick anyone you want to add.
                  </p>
                  {plan.secondLook.map((person) => (
                    <PlanRow
                      key={person.id}
                      person={person}
                      reason={person.reason}
                      checked={chosen.has(person.id)}
                      onToggle={toggle}
                    />
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || loading || chosen.size === 0}
            onClick={submit}
          >
            {saving ? 'Shortlisting…' : `Shortlist ${chosen.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}
