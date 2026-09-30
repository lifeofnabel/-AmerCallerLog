import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from './ui';

type Tone = 'ok' | 'error' | 'info';
interface Toast {
  id: number;
  tone: Tone;
  text: ReactNode;
}

const ToastContext = createContext<(text: ReactNode, tone?: Tone) => void>(() => undefined);

/** Kleine, ruhige Bestätigungen unten rechts. Fehler bleiben länger stehen. */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const show = useCallback((text: ReactNode, tone: Tone = 'ok') => {
    const id = next.current++;
    setToasts((list) => [...list.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 8000 : 3200);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cx(
              'pointer-events-auto rounded-md border px-3.5 py-2.5 text-[13px] shadow-lg',
              t.tone === 'ok' && 'border-ok/30 bg-surface text-fg',
              t.tone === 'error' && 'border-danger/40 bg-surface text-fg',
              t.tone === 'info' && 'border-line-strong bg-surface text-fg',
            )}
          >
            <span className={cx('mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle', t.tone === 'ok' ? 'bg-ok' : t.tone === 'error' ? 'bg-danger' : 'bg-info')} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (text: ReactNode, tone?: Tone) => void {
  return useContext(ToastContext);
}
