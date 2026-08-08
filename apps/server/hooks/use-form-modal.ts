import { useState, useCallback } from "react";

export interface FormModalState<T> {
  open: boolean;
  target: T | null;
  error: string | null;
  isPending: boolean;
}

export interface FormModalActions<T> {
  openWith: (item: T) => void;
  openNew: () => void;
  close: () => void;
  setError: (msg: string | null) => void;
  setPending: (v: boolean) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
}

export function useFormModal<T>(): [FormModalState<T>, FormModalActions<T>] {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setPending] = useState(false);

  const openWith = useCallback((item: T) => {
    setTarget(item); setError(null); setOpen(true);
  }, []);

  const openNew = useCallback(() => {
    setTarget(null); setError(null); setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false); setError(null); setPending(false);
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }, []);

  return [
    { open, target, error, isPending },
    { openWith, openNew, close, setError, setPending, run },
  ];
}
