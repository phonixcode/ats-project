import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useReaderStatus() {
  const [readerStatus, setReaderStatus] = useState(null);

  const refreshReaderStatus = useCallback(
    () =>
      api
        .get('/llm/status', { params: { _t: Date.now() } })
        .then((res) => setReaderStatus(res.data))
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    refreshReaderStatus();
  }, [refreshReaderStatus]);

  return [readerStatus, refreshReaderStatus];
}
