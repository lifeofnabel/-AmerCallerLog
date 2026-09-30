import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Query,
} from 'firebase/firestore';

import { getFirebase } from '@/lib/firebase';
import {
  CATEGORIES,
  STATUSES,
  type Application,
  type ApplicationInput,
  type Category,
  type Person,
  type Status,
} from '@/types/application';
import { dayKey } from '@/utils/dates';
import { cleanPhone, phoneKey } from '@/utils/phone';
import { cleanText, nameKey } from '@/utils/text';

export const APPLICATIONS = 'callerlog_applications';
export const META = 'callerlog_meta';

const appsCol = () => collection(getFirebase().db, APPLICATIONS);
const counterRef = () => doc(getFirebase().db, META, 'counter');

/** Dokument-ID eines Antrags = seine Nummer. Damit kann es jede Nummer nur einmal geben. */
export const applicationId = (sequenceNumber: number): string => String(sequenceNumber);

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);

function toPerson(value: unknown): Person {
  const v = (value ?? {}) as Partial<Person>;
  return { uid: String(v.uid ?? ''), name: String(v.name ?? '') };
}

export function fromSnapshot(snap: QueryDocumentSnapshot<DocumentData>): Application {
  const d = snap.data({ serverTimestamps: 'estimate' });
  const category = (CATEGORIES as string[]).includes(d.category) ? (d.category as Category) : 'passport';
  const status = (STATUSES as string[]).includes(d.status) ? (d.status as Status) : 'open';
  const receivedAt = toDate(d.receivedAt) ?? toDate(d.createdAt) ?? new Date(0);
  return {
    id: snap.id,
    sequenceNumber: Number(d.sequenceNumber),
    name: String(d.name ?? ''),
    phone: String(d.phone ?? ''),
    category,
    details: String(d.details ?? ''),
    status,
    previousStatus: d.previousStatus === 'completed' ? 'completed' : d.previousStatus === 'open' ? 'open' : null,
    receivedAt,
    day: String(d.day ?? dayKey(receivedAt)),
    createdAt: toDate(d.createdAt),
    createdBy: toPerson(d.createdBy),
    updatedAt: toDate(d.updatedAt),
    updatedBy: toPerson(d.updatedBy),
    cancelledAt: toDate(d.cancelledAt),
    pending: snap.metadata.hasPendingWrites,
  };
}

/** Felder, die aus den Eingaben entstehen – beim Anlegen und beim Bearbeiten gleich. */
function inputFields(input: ApplicationInput) {
  const name = cleanText(input.name);
  const phone = cleanPhone(input.phone);
  const receivedAt = input.receivedAt ?? new Date();
  return {
    name,
    nameKey: nameKey(name),
    phone,
    phoneKey: phoneKey(phone),
    category: input.category,
    details: input.details.trim(),
    receivedAt: Timestamp.fromDate(receivedAt),
    day: dayKey(receivedAt),
  };
}

export function validateInput(input: ApplicationInput): string | null {
  if (!CATEGORIES.includes(input.category)) return 'Bitte Kategorie wählen · اختر الفئة';
  if (cleanText(input.name) === '') return 'Name fehlt · الاسم مطلوب';
  if (cleanText(input.name).length > 200) return 'Name ist zu lang';
  if (phoneKey(input.phone).length < 5) return 'Telefonnummer fehlt oder ist zu kurz · رقم الهاتف مطلوب';
  if (input.details.length > 4000) return 'Details sind zu lang';
  return null;
}

class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Legt einen Antrag an und vergibt dabei die nächste Nummer – atomar in einer Transaktion:
 * Zähler lesen, +1, Zähler und Antrag zusammen schreiben. Speichern zwei Mitarbeiter gleichzeitig,
 * wiederholt Firestore die zweite Transaktion mit dem neuen Zählerstand. Nummern werden nie doppelt
 * vergeben und nie wiederverwendet – auch nicht nach dem endgültigen Löschen.
 */
export async function createApplication(input: ApplicationInput, by: Person): Promise<Application> {
  const { db } = getFirebase();
  const fields = inputFields(input);
  const attempt = () =>
    runTransaction(db, async (tx) => {
      const counter = await tx.get(counterRef());
      const last = counter.exists() ? Number(counter.get('last')) || 0 : 0;
      const next = last + 1;
      tx.set(counterRef(), { last: next, updatedAt: serverTimestamp() });
      tx.set(doc(appsCol(), applicationId(next)), {
        ...fields,
        sequenceNumber: next,
        status: 'open',
        createdAt: serverTimestamp(),
        createdBy: by,
        updatedAt: serverTimestamp(),
        updatedBy: by,
      });
      return next;
    });
  const seq = await withTimeout(retryOnContention(attempt), 20000);
  // Der gespeicherte Antrag, wie ihn die Liste zeigt – für die sofortige Anzeige, bevor der Live-Abgleich ihn liefert.
  const now = new Date();
  const receivedAt = fields.receivedAt.toDate();
  return {
    id: applicationId(seq),
    sequenceNumber: seq,
    name: fields.name,
    phone: fields.phone,
    category: fields.category,
    details: fields.details,
    status: 'open',
    previousStatus: null,
    receivedAt,
    day: fields.day,
    createdAt: now,
    createdBy: by,
    updatedAt: now,
    updatedBy: by,
    cancelledAt: null,
    pending: false,
  };
}

/**
 * Speichern zwei Geräte im selben Moment, hat eines einen veralteten Zählerstand gelesen. Firestore
 * lehnt dessen Schreibversuch ab – je nach Zeitpunkt als „aborted“ oder, weil die Nummer schon
 * vergeben ist und die Regeln das Überschreiben verbieten, als „permission-denied“. Dann einfach mit
 * frischem Zählerstand noch einmal. Echte fehlende Rechte scheitern nach wenigen Versuchen trotzdem.
 */
async function retryOnContention<T>(run: () => Promise<T>, attempts = 20): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await run();
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (i >= attempts || (code !== 'permission-denied' && code !== 'aborted')) throw err;
      await new Promise((r) => setTimeout(r, Math.min(60 * i, 800) + Math.random() * 200));
    }
  }
}

export async function updateApplication(app: Application, input: ApplicationInput, status: Status, by: Person): Promise<void> {
  await updateDoc(doc(appsCol(), app.id), {
    ...inputFields(input),
    status,
    updatedAt: serverTimestamp(),
    updatedBy: by,
  });
}

export async function setStatus(app: Application, status: 'open' | 'completed', by: Person): Promise<void> {
  await updateDoc(doc(appsCol(), app.id), { status, updatedAt: serverTimestamp(), updatedBy: by });
}

/** Stornieren = in den Papierkorb. Der bisherige Status wird gemerkt. */
export async function cancelApplication(app: Application, by: Person): Promise<void> {
  await updateDoc(doc(appsCol(), app.id), {
    status: 'cancelled',
    previousStatus: app.status === 'cancelled' ? (app.previousStatus ?? 'open') : app.status,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: by,
  });
}

/** Aus dem Papierkorb zurückholen – mit derselben Nummer und dem Status von vorher. */
export async function restoreApplication(app: Application, by: Person): Promise<void> {
  await updateDoc(doc(appsCol(), app.id), {
    status: app.previousStatus ?? 'open',
    updatedAt: serverTimestamp(),
    updatedBy: by,
  });
}

export async function deleteApplication(app: Application): Promise<void> {
  if (app.status !== 'cancelled') throw new Error('Nur stornierte Anträge können endgültig gelöscht werden.');
  await deleteDoc(doc(appsCol(), app.id));
}

type Listener = (apps: Application[], meta: { fromCache: boolean }) => void;
type ErrorListener = (err: Error) => void;

function listen(q: Query<DocumentData>, onData: Listener, onError: ErrorListener): () => void {
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => onData(snap.docs.map(fromSnapshot), { fromCache: snap.metadata.fromCache }),
    onError,
  );
}

/** Alle Anträge eines Tages (Live). */
export function subscribeDay(day: string, onData: Listener, onError: ErrorListener): () => void {
  return listen(query(appsCol(), where('day', '==', day)), onData, onError);
}

/** Die neuesten Anträge nach Nummer (Live), für „Alle“. */
export function subscribeLatest(count: number, onData: Listener, onError: ErrorListener): () => void {
  return listen(query(appsCol(), orderBy('sequenceNumber', 'desc'), limit(count)), onData, onError);
}

/** Papierkorb (Live). */
export function subscribeTrash(onData: Listener, onError: ErrorListener): () => void {
  return listen(query(appsCol(), where('status', '==', 'cancelled')), onData, onError);
}

/** Alle Anträge mit dieser Telefonnummer – für die Duplikat-Prüfung und die Suche nach Nummer. */
export async function findByPhone(key: string): Promise<Application[]> {
  if (key === '') return [];
  const snap = await getDocs(query(appsCol(), where('phoneKey', '==', key)));
  return snap.docs.map(fromSnapshot);
}

/** Nummern-Suche über alle Anträge (Präfix), z. B. „0176“ findet alle 0176-Nummern. */
export async function findByPhonePrefix(prefix: string, max = 50): Promise<Application[]> {
  if (prefix.length < 4) return [];
  const snap = await getDocs(
    query(appsCol(), where('phoneKey', '>=', prefix), where('phoneKey', '<', `${prefix}`), limit(max)),
  );
  return snap.docs.map(fromSnapshot);
}

export function isTimeout(err: unknown): boolean {
  return err instanceof TimeoutError;
}
