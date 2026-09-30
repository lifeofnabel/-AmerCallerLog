import { CATEGORY_LABELS, STATUS_LABELS, type Application } from '@/types/application';
import { dayKey, formatDateTime } from '@/utils/dates';
import { downloadText } from '@/utils/download';

/**
 * CSV für Excel: UTF-8 mit BOM (sonst zeigt Excel Arabisch als Zeichensalat) und Semikolon als
 * Trennzeichen (deutsches Excel erwartet es). Telefonnummern als ="0176…", damit Excel die
 * führende 0 nicht abschneidet.
 */
const HEADER = ['Nummer', 'Name', 'Telefon', 'Kategorie', 'Details', 'Status', 'Datum'];

function cell(value: string): string {
  // Formel-Einschleusung verhindern: Zellen, die mit =,+,-,@ beginnen, als Text markieren.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(apps: Application[]): string {
  const rows = apps.map((a) => [
    `#${a.sequenceNumber}`,
    cell(a.name),
    `="${a.phone.replace(/"/g, '')}"`,
    cell(`${CATEGORY_LABELS[a.category].ar} / ${CATEGORY_LABELS[a.category].de}`),
    cell(a.details),
    cell(`${STATUS_LABELS[a.status].de} / ${STATUS_LABELS[a.status].ar}`),
    formatDateTime(a.receivedAt),
  ]);
  return `﻿${[HEADER, ...rows].map((r) => r.join(';')).join('\r\n')}\r\n`;
}

export function downloadCsv(apps: Application[]): void {
  const sorted = [...apps].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  downloadText(`antraege-${dayKey(new Date())}.csv`, buildCsv(sorted), 'text/csv;charset=utf-8');
}
