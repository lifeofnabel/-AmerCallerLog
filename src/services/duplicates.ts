import type { Application, Category } from '@/types/application';
import { nameKey } from '@/utils/text';

/**
 * Duplikat-Prüfung beim Erfassen (Telefon + Name + Kategorie):
 *  A exact    – gleicher Name, gleiche Nummer, gleiche Kategorie → Warnung, Speichern nur nach Bestätigung
 *  B service  – gleicher Name, gleiche Nummer, andere Kategorie  → bekannter Kunde, neue Leistung (Hinweis)
 *  C family   – andere Namen mit derselben Nummer                → evtl. Familienmitglied (Hinweis)
 *  D none     – neue Nummer                                     → nichts
 * Stornierte Anträge zählen nicht als Duplikat, werden aber bei B/C mit angezeigt.
 */
export type DuplicateKind = 'exact' | 'service' | 'family' | 'none';

export interface DuplicateResult {
  kind: DuplicateKind;
  /** Genau gleiche aktive Anträge (Fall A). */
  exact: Application[];
  /** Gleiche Person, andere Kategorie (Fall B). */
  sameName: Application[];
  /** Andere Namen unter derselben Nummer (Fall C). */
  otherNames: string[];
}

export const NO_DUPLICATE: DuplicateResult = { kind: 'none', exact: [], sameName: [], otherNames: [] };

export function evaluateDuplicates(existing: Application[], name: string, category: Category): DuplicateResult {
  if (existing.length === 0) return NO_DUPLICATE;
  const key = nameKey(name);
  const byName = key === '' ? [] : existing.filter((a) => nameKey(a.name) === key);
  const exact = byName.filter((a) => a.category === category && a.status !== 'cancelled');
  const sameName = byName.filter((a) => a.category !== category);
  const otherNames = [
    ...new Map(existing.filter((a) => nameKey(a.name) !== key).map((a) => [nameKey(a.name), a.name])).values(),
  ];

  if (exact.length > 0) return { kind: 'exact', exact, sameName, otherNames };
  if (sameName.length > 0) return { kind: 'service', exact, sameName, otherNames };
  if (otherNames.length > 0) return { kind: 'family', exact, sameName, otherNames };
  return { ...NO_DUPLICATE };
}
