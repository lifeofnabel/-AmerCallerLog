import type { Application, Category } from '@/types/application';
import { phoneKey } from './phone';
import { latinDigits, nameKey } from './text';

export type StatusFilter = 'active' | 'open' | 'completed' | 'cancelled';
export type SortOrder = 'desc' | 'asc';

export interface Filters {
  search: string;
  category: Category | 'all';
  status: StatusFilter;
  sort: SortOrder;
}

export function matchesSearch(app: Application, search: string): boolean {
  const q = search.trim();
  if (q === '') return true;
  const text = nameKey(q);
  if (nameKey(app.name).includes(text) || nameKey(app.details).includes(text)) return true;
  const digits = phoneKey(q);
  if (digits.length >= 3 && phoneKey(app.phone).includes(digits)) return true;
  // „#123“ oder „123“ findet die Nummer.
  const seq = latinDigits(q).replace(/^#/, '');
  return /^\d+$/.test(seq) && String(app.sequenceNumber) === seq;
}

export function applyFilters(apps: Application[], f: Filters): Application[] {
  return apps
    .filter((a) => (f.status === 'active' ? a.status !== 'cancelled' : a.status === f.status))
    .filter((a) => f.category === 'all' || a.category === f.category)
    .filter((a) => matchesSearch(a, f.search))
    .sort((a, b) => (f.sort === 'desc' ? b.sequenceNumber - a.sequenceNumber : a.sequenceNumber - b.sequenceNumber));
}
