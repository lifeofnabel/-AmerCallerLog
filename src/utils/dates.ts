const pad = (n: number): string => String(n).padStart(2, '0');

/** Kalendertag in Ortszeit: JJJJ-MM-TT. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** 30.09.2026 */
export function formatDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** 14:05 */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Wert für <input type="datetime-local">. */
export function toLocalInput(date: Date): string {
  return `${dayKey(date)}T${formatTime(date)}`;
}

export function fromLocalInput(value: string): Date | null {
  if (value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** ISO-Kalenderwoche, z. B. „2026-W40“ – Grundlage der Wochen-Erinnerung. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}
