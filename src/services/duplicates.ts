import type { Application, Category } from '@/types/application';
import type { Rules } from './settings';
import { nameKey } from '@/utils/text';

/**
 * Prüfung beim Erfassen, sobald Kategorie + Telefon (+ Name) stehen. Stornierte Anträge zählen nicht.
 *  exact         – gleiche Nummer, gleicher Name, gleiche Kategorie → „schon erfasst als #12“ (Standard: sperren, Ausnahme möglich)
 *  sameCategory  – gleiche Nummer, gleiche Kategorie, anderer Name   → Hinweis „#12 Name“ (Sohn/Tochter?)
 *  otherCategory – gleiche Nummer, andere Kategorie                  → Hinweis „schon gehabt, andere Kategorie: #12“
 * Was genau passiert, stellen die Regeln in den Einstellungen ein.
 */
export interface DuplicateResult {
  exact: Application[];
  sameCategory: Application[];
  otherCategory: Application[];
  /** none: speichern · soft: erst nach „Trotzdem speichern“ · hard: gar nicht */
  block: 'none' | 'soft' | 'hard';
}

export const NO_DUPLICATE: DuplicateResult = { exact: [], sameCategory: [], otherCategory: [], block: 'none' };

const DAY = 86_400_000;
const newestFirst = (a: Application, b: Application) => b.sequenceNumber - a.sequenceNumber;

function inScope(app: Application, scope: Rules['exactScope'], now: number): boolean {
  if (scope === 'open') return app.status === 'open';
  if (scope === 'days30') return now - app.receivedAt.getTime() <= 30 * DAY;
  return true;
}

export function evaluateDuplicates(
  existing: Application[],
  name: string,
  category: Category,
  rules: Rules,
  now = Date.now(),
): DuplicateResult {
  const active = existing.filter((a) => a.status !== 'cancelled');
  if (active.length === 0) return NO_DUPLICATE;
  const key = nameKey(name);
  const same = active.filter((a) => a.category === category);
  const sameName = key === '' ? [] : same.filter((a) => nameKey(a.name) === key);

  // „Alles gleich“ nur, wenn die Regel es zählt; ältere gleiche Anträge außerhalb des Zeitraums werden zum Hinweis.
  const exact = rules.exact === 'off' ? [] : sameName.filter((a) => inScope(a, rules.exactScope, now));
  const exactIds = new Set(exact.map((a) => a.id));
  const sameCategory = rules.sameCategory === 'off' ? [] : same.filter((a) => !exactIds.has(a.id));
  const otherCategory = rules.otherCategory === 'off' ? [] : active.filter((a) => a.category !== category);

  const block = exact.length === 0 ? 'none' : rules.exact === 'hard' ? 'hard' : rules.exact === 'block' ? 'soft' : 'none';
  return {
    exact: exact.sort(newestFirst),
    sameCategory: sameCategory.sort(newestFirst),
    otherCategory: otherCategory.sort(newestFirst),
    block,
  };
}
