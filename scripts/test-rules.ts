// Prüft die Firestore-Regeln von Caller Log und die gleichzeitige Nummernvergabe gegen den Emulator.
//   npm run emulators   (in einem zweiten Fenster, vorher: npm run ec:rules -- --emulator)
//   npm run test:rules
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { CALLERLOG_ROOT } from './ec';

const env = await initializeTestEnvironment({
  projectId: 'demo-callerlog',
  firestore: {
    rules: readFileSync(join(CALLERLOG_ROOT, '.emulator', 'firestore.rules'), 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

let failed = 0;
async function check(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users/staff1'), { active: true, role: 'employee', displayName: 'Mitarbeiter Eins' });
  await setDoc(doc(db, 'users/staff2'), { active: true, role: 'manager', displayName: 'Managerin' });
  await setDoc(doc(db, 'users/admin'), { active: true, role: 'admin', displayName: 'Admin' });
  await setDoc(doc(db, 'users/inactive'), { active: false, role: 'employee', displayName: 'Gesperrt' });
});

const as = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@test.de`, email_verified: true }).firestore() as unknown as Firestore;
const anon = env.unauthenticatedContext().firestore() as unknown as Firestore;
const noProfile = as('stranger');
const inactive = as('inactive');
const staff = as('staff1');

function fields(seq: number, by = 'staff1') {
  const now = Timestamp.now();
  return {
    sequenceNumber: seq,
    name: `Test ${seq}`,
    nameKey: `test ${seq}`,
    phone: '0176 123',
    phoneKey: '0176123',
    category: 'passport',
    details: '',
    status: 'open',
    receivedAt: now,
    day: '2026-09-30',
    createdAt: serverTimestamp(),
    createdBy: { uid: by, name: by },
    updatedAt: serverTimestamp(),
    updatedBy: { uid: by, name: by },
  };
}

/** Genau der Ablauf aus src/services/applications.ts → createApplication (inkl. Wiederholung bei Konflikt). */
async function create(db: Firestore, by = 'staff1', attempts = 20): Promise<number> {
  for (let i = 1; ; i++) {
    try {
      return await createOnce(db, by);
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (i >= attempts || (code !== 'permission-denied' && code !== 'aborted')) throw err;
      await new Promise((r) => setTimeout(r, Math.min(60 * i, 800) + Math.random() * 200));
    }
  }
}

function createOnce(db: Firestore, by: string): Promise<number> {
  return runTransaction(db, async (tx) => {
    const counterRef = doc(db, 'callerlog_meta/counter');
    const counter = await tx.get(counterRef);
    const next = (counter.exists() ? Number(counter.get('last')) : 0) + 1;
    tx.set(counterRef, { last: next, updatedAt: serverTimestamp() });
    tx.set(doc(db, 'callerlog_applications', String(next)), fields(next, by));
    return next;
  });
}

console.log('Zugang');
await check('ohne Anmeldung: kein Lesen', () => assertFails(getDocs(collection(anon, 'callerlog_applications'))));
await check('ohne EC-Profil: kein Lesen', () => assertFails(getDocs(collection(noProfile, 'callerlog_applications'))));
await check('gesperrtes Profil: kein Lesen', () => assertFails(getDocs(collection(inactive, 'callerlog_applications'))));
await check('ohne EC-Profil: kein Anlegen', () => assertFails(create(noProfile, 'stranger', 1)));
await check('Mitarbeiter (Rolle employee) darf lesen', () => assertSucceeds(getDocs(collection(staff, 'callerlog_applications'))));
await check('Manager darf anlegen', () => assertSucceeds(create(as('staff2'), 'staff2')));
await check('Admin darf anlegen', () => assertSucceeds(create(as('admin'), 'admin')));
await check('andere EC-Daten bleiben gesperrt (sada_x)', () => assertFails(getDoc(doc(staff, 'sada_irgendwas/1'))));

console.log('Nummern');
await check('Anlegen ohne Zähler-Erhöhung wird abgelehnt', () => assertFails(setDoc(doc(staff, 'callerlog_applications/99'), fields(99))));
await check('ID muss der Nummer entsprechen', () =>
  assertFails(
    runTransaction(staff, async (tx) => {
      tx.set(doc(staff, 'callerlog_meta/counter'), { last: 50, updatedAt: serverTimestamp() });
      tx.set(doc(staff, 'callerlog_applications/abc'), fields(50));
    }),
  ),
);
await check('bestehenden Antrag per Neuanlage überschreiben wird abgelehnt', () =>
  assertFails(setDoc(doc(staff, 'callerlog_applications/1'), fields(1))),
);
await check('Zähler kann nicht verkleinert werden', () => assertFails(setDoc(doc(staff, 'callerlog_meta/counter'), { last: 0, updatedAt: serverTimestamp() })));
await check('Nummer eines Antrags ist unveränderlich', () => assertFails(updateDoc(doc(staff, 'callerlog_applications/1'), { sequenceNumber: 7 })));
await check('ungültige Kategorie wird abgelehnt', () => assertFails(updateDoc(doc(staff, 'callerlog_applications/1'), { category: 'visa' })));
await check('leerer Name wird abgelehnt', () => assertFails(updateDoc(doc(staff, 'callerlog_applications/1'), { name: '' })));
await check('fremde Felder werden abgelehnt', () => assertFails(updateDoc(doc(staff, 'callerlog_applications/1'), { hacked: true })));

console.log('Bearbeiten, Papierkorb, Löschen');
await check('Status erledigt', () => assertSucceeds(updateDoc(doc(staff, 'callerlog_applications/1'), { status: 'completed', updatedAt: serverTimestamp() })));
await check('stornieren', () =>
  assertSucceeds(updateDoc(doc(staff, 'callerlog_applications/1'), { status: 'cancelled', previousStatus: 'completed', cancelledAt: serverTimestamp() })),
);
await check('wiederherstellen', () => assertSucceeds(updateDoc(doc(staff, 'callerlog_applications/1'), { status: 'completed' })));
await check('endgültig löschen', () => assertSucceeds(deleteDoc(doc(staff, 'callerlog_applications/2'))));
await check('nach dem Löschen: nächste Nummer ist 3, nicht 2', async () => {
  const n = await create(staff);
  if (n !== 3) throw new Error(`bekam #${n}`);
});
await check('Backup-Status schreiben', () =>
  assertSucceeds(setDoc(doc(staff, 'callerlog_meta/backup'), { lastWeek: '2026-W40', lastAt: serverTimestamp(), lastBy: { uid: 'staff1', name: 'x' } })),
);

console.log('Gleichzeitig: 4 Geräte × 10 Anträge parallel');
await check('40 parallele Anträge bekommen 40 verschiedene, lückenlose Nummern', async () => {
  const devices = ['staff1', 'staff2', 'admin', 'staff1'].map((uid) => ({ uid, db: as(uid) }));
  const results = await Promise.all(devices.flatMap(({ uid, db }) => Array.from({ length: 10 }, () => create(db, uid))));
  const unique = new Set(results);
  if (unique.size !== 40) throw new Error(`nur ${unique.size} verschiedene Nummern: ${results.sort((a, b) => a - b).join(',')}`);
  const sorted = [...unique].sort((a, b) => a - b);
  if (sorted[0] !== 4 || sorted.at(-1) !== 43) throw new Error(`Bereich ${sorted[0]}–${sorted.at(-1)}`);
  const snap = await getDocs(collection(staff, 'callerlog_applications'));
  if (snap.size !== 42) throw new Error(`${snap.size} Dokumente statt 42`);
  const counter = await getDoc(doc(staff, 'callerlog_meta/counter'));
  if (counter.get('last') !== 43) throw new Error(`Zähler ${counter.get('last')}`);
});

await env.cleanup();
console.log(failed === 0 ? '\nAlle Prüfungen bestanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
