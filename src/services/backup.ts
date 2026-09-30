import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

import { getFirebase, firebaseProjectId } from '@/lib/firebase';
import { APPLICATIONS, META, applicationId, fromSnapshot } from './applications';
import { CATEGORIES, STATUSES, type Application, type Person } from '@/types/application';
import { dayKey, isoWeekKey } from '@/utils/dates';
import { downloadText } from '@/utils/download';
import { phoneKey } from '@/utils/phone';
import { nameKey } from '@/utils/text';

/**
 * Backup-Format (JSON). Enthält ALLES, was zum Wiederherstellen nötig ist: jeden Antrag
 * (offen, erledigt, storniert) mit allen Feldern und den Zählerstand, damit Nummern auch
 * nach einer Wiederherstellung nie doppelt vergeben werden.
 */
export const BACKUP_FORMAT = 'callerlog-backup';
export const BACKUP_VERSION = 1;

export interface BackupApplication {
  id: string;
  sequenceNumber: number;
  name: string;
  phone: string;
  category: Application['category'];
  details: string;
  status: Application['status'];
  previousStatus: Application['previousStatus'];
  receivedAt: string;
  day: string;
  createdAt: string | null;
  createdBy: Person;
  updatedAt: string | null;
  updatedBy: Person;
  cancelledAt: string | null;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  exportedBy: Person;
  projectId: string;
  counter: { last: number };
  applications: BackupApplication[];
}

const appsCol = () => collection(getFirebase().db, APPLICATIONS);
const counterRef = () => doc(getFirebase().db, META, 'counter');
const backupStateRef = () => doc(getFirebase().db, META, 'backup');

const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

function toBackup(a: Application): BackupApplication {
  return {
    id: a.id,
    sequenceNumber: a.sequenceNumber,
    name: a.name,
    phone: a.phone,
    category: a.category,
    details: a.details,
    status: a.status,
    previousStatus: a.previousStatus,
    receivedAt: a.receivedAt.toISOString(),
    day: a.day,
    createdAt: iso(a.createdAt),
    createdBy: a.createdBy,
    updatedAt: iso(a.updatedAt),
    updatedBy: a.updatedBy,
    cancelledAt: iso(a.cancelledAt),
  };
}

/** Kompletter Stand direkt vom Server (nicht aus dem Zwischenspeicher). */
export async function buildBackup(by: Person): Promise<BackupFile> {
  const [snap, counter] = await Promise.all([getDocsFromServer(appsCol()), getDocFromServer(counterRef())]);
  const applications = snap.docs.map(fromSnapshot).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const maxSeq = applications.reduce((m, a) => Math.max(m, a.sequenceNumber), 0);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: by,
    projectId: firebaseProjectId,
    counter: { last: Math.max(counter.exists() ? Number(counter.get('last')) || 0 : 0, maxSeq) },
    applications: applications.map(toBackup),
  };
}

export function backupFilename(prefix = 'applications-backup'): string {
  const now = new Date();
  return `${prefix}-${dayKey(now)}.json`;
}

/** Backup herunterladen und für diese Woche als erledigt vermerken (für alle Geräte). */
export async function downloadBackup(by: Person, prefix?: string): Promise<BackupFile> {
  const backup = await buildBackup(by);
  downloadText(backupFilename(prefix), `${JSON.stringify(backup, null, 2)}\n`, 'application/json');
  await setDoc(backupStateRef(), { lastWeek: isoWeekKey(new Date()), lastAt: serverTimestamp(), lastBy: by });
  return backup;
}

/** Wochenstand des Backups (Live) – steuert die Erinnerung. */
export function subscribeBackupState(onData: (lastWeek: string | null) => void): () => void {
  return onSnapshot(
    backupStateRef(),
    (snap) => onData(snap.exists() ? String(snap.get('lastWeek') ?? '') || null : null),
    () => onData(null),
  );
}

// ---------------------------------------------------------------------------
// Prüfen

export interface BackupCheck {
  ok: boolean;
  errors: string[];
  backup: BackupFile | null;
  summary: { total: number; open: number; completed: number; cancelled: number; maxSeq: number };
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isIsoDate = (v: unknown): boolean => isStr(v) && !Number.isNaN(Date.parse(v));

function isPerson(v: unknown): v is Person {
  return typeof v === 'object' && v !== null && isStr((v as Person).uid) && isStr((v as Person).name);
}

export function checkBackup(text: string): BackupCheck {
  const summary = { total: 0, open: 0, completed: 0, cancelled: 0, maxSeq: 0 };
  const fail = (...errors: string[]): BackupCheck => ({ ok: false, errors, backup: null, summary });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('Die Datei ist kein gültiges JSON.');
  }
  const b = raw as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) return fail('Das ist keine Caller-Log-Sicherung.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) return fail('Unbekannte Backup-Version.');
  if (!Array.isArray(b.applications)) return fail('Die Sicherung enthält keine Anträge.');
  if (typeof b.counter?.last !== 'number' || !Number.isInteger(b.counter.last) || b.counter.last < 0) return fail('Zählerstand fehlt.');

  const errors: string[] = [];
  const seen = new Set<number>();
  b.applications.forEach((a, i) => {
    const where = `Eintrag ${i + 1}`;
    if (typeof a !== 'object' || a === null) return void errors.push(`${where}: kein Objekt.`);
    if (!Number.isInteger(a.sequenceNumber) || a.sequenceNumber <= 0) return void errors.push(`${where}: ungültige Nummer.`);
    if (seen.has(a.sequenceNumber)) errors.push(`${where}: Nummer #${a.sequenceNumber} doppelt.`);
    seen.add(a.sequenceNumber);
    if (a.id !== applicationId(a.sequenceNumber)) errors.push(`${where}: ID passt nicht zur Nummer.`);
    if (!isStr(a.name) || a.name.trim() === '' || a.name.length > 200) errors.push(`${where}: Name fehlt.`);
    if (!isStr(a.phone) || a.phone.trim() === '' || a.phone.length > 40) errors.push(`${where}: Telefon fehlt.`);
    if (!isStr(a.details) || a.details.length > 4000) errors.push(`${where}: Details ungültig.`);
    if (!CATEGORIES.includes(a.category)) errors.push(`${where}: Kategorie ungültig.`);
    if (!STATUSES.includes(a.status)) errors.push(`${where}: Status ungültig.`);
    if (a.previousStatus !== null && a.previousStatus !== 'open' && a.previousStatus !== 'completed')
      errors.push(`${where}: vorheriger Status ungültig.`);
    if (!isIsoDate(a.receivedAt)) errors.push(`${where}: Datum ungültig.`);
    if (!isStr(a.day) || !/^\d{4}-\d{2}-\d{2}$/.test(a.day)) errors.push(`${where}: Tag ungültig.`);
    for (const key of ['createdAt', 'updatedAt', 'cancelledAt'] as const) {
      if (a[key] !== null && !isIsoDate(a[key])) errors.push(`${where}: ${key} ungültig.`);
    }
    if (!isPerson(a.createdBy) || !isPerson(a.updatedBy)) errors.push(`${where}: Mitarbeiterangabe ungültig.`);
    summary.total += 1;
    if (a.status === 'open' || a.status === 'completed' || a.status === 'cancelled') summary[a.status] += 1;
    summary.maxSeq = Math.max(summary.maxSeq, a.sequenceNumber || 0);
  });
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 10), backup: null, summary };
  return { ok: true, errors: [], backup: b as BackupFile, summary };
}

// ---------------------------------------------------------------------------
// Wiederherstellen (komplett ersetzen)

const tsOrNull = (v: string | null): Timestamp | null => (v === null ? null : Timestamp.fromDate(new Date(v)));

function toFirestore(a: BackupApplication): Record<string, unknown> {
  const receivedAt = Timestamp.fromDate(new Date(a.receivedAt));
  const data: Record<string, unknown> = {
    sequenceNumber: a.sequenceNumber,
    name: a.name,
    nameKey: nameKey(a.name),
    phone: a.phone,
    phoneKey: phoneKey(a.phone),
    category: a.category,
    details: a.details,
    status: a.status,
    receivedAt,
    day: a.day,
    createdAt: tsOrNull(a.createdAt) ?? receivedAt,
    createdBy: { uid: a.createdBy.uid, name: a.createdBy.name },
    updatedAt: tsOrNull(a.updatedAt) ?? receivedAt,
    updatedBy: { uid: a.updatedBy.uid, name: a.updatedBy.name },
  };
  if (a.previousStatus !== null) data.previousStatus = a.previousStatus;
  if (a.cancelledAt !== null) data.cancelledAt = tsOrNull(a.cancelledAt);
  return data;
}

export interface RestoreResult {
  written: number;
  deleted: number;
  counter: number;
}

/**
 * Setzt die Datenbank genau auf den Stand der Sicherung. Anträge, die es in der Sicherung nicht gibt,
 * werden gelöscht. Der Zähler wird nie kleiner – neue Anträge bekommen weiterhin nie eine alte Nummer.
 * Vorher sollte der aktuelle Stand gesichert werden (macht die Oberfläche automatisch).
 */
export async function restoreBackup(backup: BackupFile, onProgress?: (done: number, total: number) => void): Promise<RestoreResult> {
  const { db } = getFirebase();
  const [current, counter] = await Promise.all([getDocsFromServer(appsCol()), getDocFromServer(counterRef())]);
  const existing = current.docs.map((d) => d.id);
  const wanted = new Map(backup.applications.map((a) => [a.id, a]));

  // 1. Zähler zuerst: Die Regeln erlauben neue Anträge nur bis zum Zählerstand.
  const maxSeq = backup.applications.reduce((m, a) => Math.max(m, a.sequenceNumber), 0);
  const currentLast = counter.exists() ? Number(counter.get('last')) || 0 : 0;
  const last = Math.max(currentLast, backup.counter.last, maxSeq);
  await setDoc(counterRef(), { last, updatedAt: serverTimestamp() });

  // 2. Alles Bestehende löschen. Anlagezeit und Ersteller eines Antrags lassen sich per Regel nicht
  //    ändern, deshalb wird jeder Antrag der Sicherung frisch angelegt statt überschrieben.
  const toDelete = existing;
  const total = toDelete.length + backup.applications.length;
  let done = 0;
  const CHUNK = 400;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const id of toDelete.slice(i, i + CHUNK)) batch.delete(doc(appsCol(), id));
    await batch.commit();
    done += Math.min(CHUNK, toDelete.length - i);
    onProgress?.(done, total);
  }

  // 3. Alle Anträge der Sicherung schreiben.
  for (let i = 0; i < backup.applications.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const a of backup.applications.slice(i, i + CHUNK)) batch.set(doc(appsCol(), a.id), toFirestore(a));
    await batch.commit();
    done += Math.min(CHUNK, backup.applications.length - i);
    onProgress?.(done, total);
  }

  return { written: backup.applications.length, deleted: toDelete.filter((id) => !wanted.has(id)).length, counter: last };
}
