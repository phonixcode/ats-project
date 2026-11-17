import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { userError } from '../lib/format';

const TYPING_PAUSE_MS = 300;

export function useShortlistPlan(jobId, initialLimit) {
  const [limit, setLimit] = useState(initialLimit);
  const [plan, setPlan] = useState(null);
  const [chosen, setChosen] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(limit) || limit < 1) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .get(`/jobs/${jobId}/shortlist-plan`, { params: { limit } })
        .then((res) => {
          if (cancelled) return;
          setPlan(res.data);
          setChosen(new Set(res.data.picks.map((person) => person.id)));
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(userError(err, 'We couldn’t work out a shortlist. Try again.'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, TYPING_PAUSE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, limit]);

  const toggle = (id) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const shortlistChosen = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/applications/bulk-review', {
        applicationIds: [...chosen],
        humanDecision: 'SHORTLIST',
      });
      return chosen.size;
    } catch (err) {
      setError(userError(err, 'We couldn’t shortlist those candidates. Try again.'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { limit, setLimit, plan, chosen, toggle, loading, error, saving, shortlistChosen };
}
