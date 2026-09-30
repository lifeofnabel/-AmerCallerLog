import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';
import { META } from './applications';
import type { Person } from '@/types/application';

/**
 * Regeln für die Prüfung beim Erfassen – gelten für alle Geräte (callerlog_meta/settings).
 * Ändern wirkt sofort überall, ohne Deploy.
 */
export interface Rules {
  /** Gleiche Nummer + gleicher Name + gleiche Kategorie. */
  exact: 'block' | 'hard' | 'hint' | 'off';
  /** Welche früheren Anträge für „alles gleich“ zählen. */
  exactScope: 'always' | 'open' | 'days30';
  /** Gleiche Nummer + gleiche Kategorie, anderer Name (Familie?). */
  sameCategory: 'hint' | 'off';
  /** Gleiche Nummer, andere Kategorie. */
  otherCategory: 'hint' | 'off';
}

export const DEFAULT_RULES: Rules = {
  exact: 'block',
  exactScope: 'always',
  sameCategory: 'hint',
  otherCategory: 'hint',
};

const settingsRef = () => doc(getFirebase().db, META, 'settings');

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseRules(data: Record<string, unknown> | undefined): Rules {
  const d = data ?? {};
  return {
    exact: pick(d.exact, ['block', 'hard', 'hint', 'off'] as const, DEFAULT_RULES.exact),
    exactScope: pick(d.exactScope, ['always', 'open', 'days30'] as const, DEFAULT_RULES.exactScope),
    sameCategory: pick(d.sameCategory, ['hint', 'off'] as const, DEFAULT_RULES.sameCategory),
    otherCategory: pick(d.otherCategory, ['hint', 'off'] as const, DEFAULT_RULES.otherCategory),
  };
}

export function subscribeRules(onData: (rules: Rules) => void): () => void {
  return onSnapshot(
    settingsRef(),
    (snap) => onData(parseRules(snap.data())),
    () => onData(DEFAULT_RULES),
  );
}

export async function saveRules(rules: Rules, by: Person): Promise<void> {
  await setDoc(settingsRef(), { ...rules, updatedAt: serverTimestamp(), updatedBy: by });
}
