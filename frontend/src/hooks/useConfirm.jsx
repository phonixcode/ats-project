import { useCallback, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (next) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const settle = useCallback((answer) => {
    resolveRef.current?.(answer);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const onCancel = useCallback(() => settle(false), [settle]);
  const onConfirm = useCallback(() => settle(true), [settle]);

  const dialog = options ? <ConfirmDialog {...options} onConfirm={onConfirm} onCancel={onCancel} /> : null;

  return [confirm, dialog];
}
