import { useEffect, useState } from 'react';
import { subscribeDay, subscribeLatest, subscribeTrash } from '@/services/applications';
import type { Application } from '@/types/application';
import { todayKey } from '@/utils/dates';

export type DateScope = 'today' | 'all';
export type Source = { kind: 'day'; day: string } | { kind: 'latest'; count: number } | { kind: 'trash' };

interface State {
  apps: Application[];
  loading: boolean;
  fromCache: boolean;
  error: string | null;
}

/** Live-Liste aus Firestore. Wechselt die Quelle, wird neu abonniert. */
export function useLiveApplications(source: Source): State {
  const [state, setState] = useState<State>({ apps: [], loading: true, fromCache: false, error: null });
  const key = source.kind === 'day' ? `day:${source.day}` : source.kind === 'latest' ? `latest:${source.count}` : 'trash';

  useEffect(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const onData = (apps: Application[], meta: { fromCache: boolean }) =>
      setState({ apps, loading: false, fromCache: meta.fromCache, error: null });
    const onError = (err: Error) =>
      setState((s) => ({
        ...s,
        loading: false,
        error: (err as { code?: string }).code === 'permission-denied' ? 'Kein Zugriff auf die Daten.' : 'Daten konnten nicht geladen werden.',
      }));
    if (source.kind === 'day') return subscribeDay(source.day, onData, onError);
    if (source.kind === 'latest') return subscribeLatest(source.count, onData, onError);
    return subscribeTrash(onData, onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

/** Heutiges Datum, das um Mitternacht von selbst weiterspringt. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}

/** Online-Status des Browsers. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
