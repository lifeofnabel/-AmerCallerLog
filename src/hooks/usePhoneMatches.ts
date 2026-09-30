import { useEffect, useState } from 'react';
import { findByPhone } from '@/services/applications';
import type { Application } from '@/types/application';
import { MIN_PHONE_DIGITS, phoneKey } from '@/utils/phone';

/**
 * Alle bestehenden Anträge zur eingegebenen Nummer – leicht verzögert, damit Tippen nicht bremst.
 * Eine einzige Abfrage auf ein indiziertes Feld; das Ergebnis bleibt, solange sich die Nummer nicht ändert.
 */
export function usePhoneMatches(
  phone: string,
  refreshKey = 0,
): { matches: Application[]; key: string; checking: boolean; resolve: () => Promise<Application[]> } {
  const key = phoneKey(phone);
  const [state, setState] = useState<{ key: string; matches: Application[] }>({ key: '', matches: [] });

  useEffect(() => {
    if (key.length < MIN_PHONE_DIGITS) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      findByPhone(key)
        .then((matches) => {
          if (!cancelled) setState({ key, matches });
        })
        .catch(() => {
          // Keine Prüfung möglich (offline ohne Zwischenspeicher) – Erfassen darf daran nicht scheitern.
          if (!cancelled) setState({ key, matches: [] });
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, refreshKey]);

  const valid = key.length >= MIN_PHONE_DIGITS;
  const ready = valid && state.key === key;
  return {
    key,
    matches: ready ? state.matches : [],
    checking: valid && !ready,
    // Beim Speichern: fertiges Ergebnis nehmen oder jetzt sofort nachsehen – nie ungeprüft speichern.
    resolve: async () => {
      if (!valid) return [];
      if (ready) return state.matches;
      try {
        return await findByPhone(key);
      } catch {
        return [];
      }
    },
  };
}
