// Kompletter Durchlauf im Browser gegen die Firebase-Emulatoren (zwei Mitarbeiter, Tablet, Handy).
// Voraussetzungen (je ein eigenes Fenster):
//   npm run ec:rules -- --emulator && npm run emulators
//   VITE_USE_EMULATORS=true npm run dev
// Dann: npm run test:e2e   (LÖSCHT alle Daten im Emulator!)
// Chromium-Pfad über CHROMIUM_PATH, sonst der von Playwright installierte.
import { chromium } from 'playwright-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SP = process.env.OUT_DIR ?? mkdtempSync(join(tmpdir(), 'callerlog-e2e-'));
const URL = 'http://127.0.0.1:5174/callerlog/';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-callerlog/databases/(default)/documents';

async function account(email) {
  const res = await fetch(AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'geheim123', returnSecureToken: true }) });
  const data = await res.json();
  if (data.localId) return data.localId;
  // Gibt es schon: anmelden.
  const r2 = await fetch(AUTH.replace('accounts:signUp', 'accounts:signInWithPassword'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'geheim123', returnSecureToken: true }) });
  return (await r2.json()).localId;
}
async function profile(uid, name) {
  await fetch(`${FS}/users/${uid}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { active: { booleanValue: true }, role: { stringValue: 'employee' }, displayName: { stringValue: name } } }),
  });
}
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-callerlog/databases/(default)/documents', { method: 'DELETE' });
await profile(await account('anna@amer.test'), 'Anna Weber');
await profile(await account('bilal@amer.test'), 'Bilal Hassan');
await account('fremd@amer.test');

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failed = 0;
const ok = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) failed++; };

async function login(ctxOpts, email) {
  const ctx = await browser.newContext({ acceptDownloads: true, ...ctxOpts });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:5174' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('PERMISSION_DENIED') && !m.text().includes('permission') && !m.text().includes('ERR_INTERNET_DISCONNECTED') && !m.text().includes('403')) console.log('CONSOLE', m.text().slice(0, 200)); });
  await page.goto(URL);
  await page.fill('#login-email', email);
  await page.fill('#login-password', 'geheim123');
  await page.click('button[type=submit]');
  return page;
}
const rowByNum = (page, n) => page.locator(`table tbody tr[data-seq="${n}"]`);

// 1. Anmeldung
console.log('Anmeldung');
const fremd = await login({}, 'fremd@amer.test');
await fremd.waitForSelector('text=Kein Zugang');
ok(true, 'Konto ohne EC-Profil sieht „Kein Zugang“');
await fremd.context().close();

const anna = await login({ viewport: { width: 1440, height: 900 } }, 'anna@amer.test');
await anna.waitForSelector('#entry-name');
ok(true, 'Anna landet direkt im Erfassungsformular');
const bilal = await login({ viewport: { width: 1024, height: 1366 }, isMobile: false }, 'bilal@amer.test');
await bilal.waitForSelector('#entry-name');

ok(await anna.isVisible('text=Wöchentliches Backup empfohlen'), 'Backup-Erinnerung sichtbar (diese Woche noch kein Backup)');

// 2. Erfassen per Tastatur
console.log('Erfassen');
const focusedRole = await anna.evaluate(() => document.activeElement?.getAttribute('role'));
ok(focusedRole === 'radio', 'Fokus startet auf der Kategorie');
await anna.keyboard.press('1');
ok(await anna.evaluate(() => document.activeElement?.id) === 'entry-name', 'Taste 1 wählt جواز und springt zum Namen');
await anna.keyboard.type('Ahmed Ali');
await anna.keyboard.press('Tab');
await anna.keyboard.type('0176 1234567');
await anna.keyboard.press('Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#1"))');
ok(true, 'Enter speichert → #1');
ok(await anna.inputValue('#entry-name') === '' && await anna.inputValue('#entry-phone') === '', 'Formular geleert');
ok(await anna.evaluate(() => document.activeElement?.id) === 'entry-name', 'Fokus zurück auf Name (Kategorie bleibt)');
ok(await anna.getAttribute('[role=radio][aria-checked=true]', 'aria-checked') === 'true', 'Kategorie bleibt gewählt');
await rowByNum(anna, 1).waitFor();
ok(true, '#1 steht in „Heutige Anträge“');

// Gleiche Nummer + gleiche Kategorie, anderer Name (arabisch) → Hinweis mit #1
await anna.fill('#entry-name', 'سارة علي');
await anna.fill('#entry-phone', '+49 176 1234567');
await anna.waitForSelector('text=Nummer schon in dieser Kategorie');
ok(await anna.locator('[role=status]:has-text("Nummer schon in dieser Kategorie") >> text=#1').count() > 0, 'Gleiche Nummer+Kategorie, anderer Name → Hinweis mit #1 und Name');
await anna.keyboard.press('Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#2"))');
ok(true, 'Hinweis blockiert nicht → #2');

// Alles gleich (andere Schreibweise des Namens) → gesperrt, Ausnahme möglich
await anna.fill('#entry-name', 'ahmed  ali');
await anna.fill('#entry-phone', '01761234567');
await anna.waitForSelector('text=Schon erfasst als #1');
ok(true, 'Alles gleich → „Schon erfasst als #1“');
await anna.press('#entry-phone', 'Enter');
await anna.waitForSelector('text=Enter bestätigt');
ok(!(await anna.locator('[role=status]:has(b:text-is("#3"))').count()), 'Alles gleich: erstes Enter speichert NICHT');
await anna.keyboard.press('Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#3"))');
ok(true, 'Ausnahme bestätigt → #3');

// Gleiche Nummer, andere Kategorie → nur Hinweis
await anna.click('[role=radio]:has-text("وكالة")');
await anna.fill('#entry-name', 'Ahmed Ali');
await anna.fill('#entry-phone', '0176 1234567');
await anna.waitForSelector('text=Schon gehabt, andere Kategorie');
ok(!(await anna.isVisible('text=Schon erfasst als')), 'Andere Kategorie → Hinweis „schon gehabt“, keine Sperre');
await anna.fill('#entry-details', 'Vollmacht für Bruder');
await anna.keyboard.press('Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#4"))');
ok(true, 'Andere Kategorie speichert sofort → #4');

// Neue Nummer
await anna.click('[role=radio]:has-text("وطنية")');
await anna.fill('#entry-name', 'Omar Hassan');
await anna.fill('#entry-phone', '0172 9998887');
await anna.waitForTimeout(600);
ok(!(await anna.isVisible('text=Nummer schon')) && !(await anna.isVisible('text=Schon gehabt')) && !(await anna.isVisible('text=Schon erfasst')), 'Neue Nummer → kein Hinweis');
const nowHHMM = new Date().toTimeString().slice(0, 5);
const timeVal = await anna.inputValue('input[type=time]');
ok(Math.abs(Number(timeVal.replace(':', '')) - Number(nowHHMM.replace(':', ''))) <= 1, `Uhrzeit steht auf „jetzt“ (${timeVal})`);
await anna.keyboard.press('Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#5"))');
await rowByNum(anna, 5).waitFor({ timeout: 2000 });
ok(true, '#5 sofort in der Liste, ohne Neuladen');

// Pflichtfelder
await anna.fill('#entry-name', 'Nur Name');
await anna.keyboard.press('Enter');
await anna.waitForSelector('text=Telefonnummer fehlt');
ok(true, 'Ohne Telefon: Fehlermeldung, nichts gespeichert');
await anna.fill('#entry-name', '');

// Einstellungen: hart sperren – gilt sofort auch auf Bilals Gerät
console.log('Einstellungen / Tag-Nacht');
await anna.click('[aria-label=Menü]');
await anna.click('[role=menuitem]:has-text("Einstellungen")');
await anna.click('dialog[open] label:has-text("Hart sperren")');
await anna.click('dialog[open] button:has-text("Speichern")');
await anna.waitForSelector('text=Einstellungen gespeichert');
await bilal.click('[role=radio]:has-text("جواز")');
await bilal.fill('#entry-name', 'Ahmed Ali');
await bilal.fill('#entry-phone', '0176 1234567');
await bilal.waitForSelector('text=Speichern ist gesperrt');
ok(await bilal.locator('form button[type=submit]').isDisabled(), 'Hart sperren gilt sofort auf dem anderen Gerät, Speichern gesperrt');
await bilal.fill('#entry-name', '');
await bilal.fill('#entry-phone', '');
await anna.click('[aria-label=Menü]');
await anna.click('[role=menuitem]:has-text("Einstellungen")');
await anna.click('dialog[open] label:has-text("Sperren, Ausnahme möglich")');
await anna.click('dialog[open] button:has-text("Speichern")');
await anna.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => undefined);
const before = await anna.evaluate(() => document.documentElement.dataset.theme);
await anna.click('button[aria-label*="modus"]');
const after = await anna.evaluate(() => document.documentElement.dataset.theme);
ok(before !== after, `Tag/Nacht umgeschaltet (${before} → ${after})`);
await anna.screenshot({ path: `${SP}/theme-${after}.png`, fullPage: true });
await anna.click('button[aria-label*="modus"]');
ok((await anna.evaluate(() => document.documentElement.dir)) === 'rtl', 'Oberfläche rechts nach links');

// 3. Live auf dem zweiten Gerät
console.log('Mehrere Geräte');
await rowByNum(bilal, 5).waitFor({ timeout: 5000 });
ok(true, 'Bilal (iPad) sieht #1–#5 live, ohne Neuladen');

// Gleichzeitig speichern
async function fill(page, name, phone) {
  await page.click('[role=radio]:has-text("جواز")');
  await page.fill('#entry-name', name);
  await page.fill('#entry-phone', phone);
  await page.waitForTimeout(500);
}
await fill(anna, 'Gleichzeitig A', '0151 1111111');
await fill(bilal, 'Gleichzeitig B', '0151 2222222');
await Promise.all([anna.press('#entry-phone', 'Enter'), bilal.press('#entry-phone', 'Enter')]);
const seqOf = async (page, name) => {
  const r = page.locator('table tbody tr', { hasText: name });
  await r.waitFor({ timeout: 15000 });
  return r.getAttribute('data-seq');
};
const na = await seqOf(bilal, 'Gleichzeitig A');
const nb = await seqOf(anna, 'Gleichzeitig B');
ok(na !== nb && [na, nb].sort().join() === '6,7', `Gleichzeitig gespeichert → verschiedene Nummern (#${na}, #${nb}), beide sehen beide`);

// 4. Status, Bearbeiten
console.log('Status / Bearbeiten');
await rowByNum(anna, 1).locator('[role=switch]').click();
await rowByNum(bilal, 1).locator('[role=switch][aria-checked=true]').waitFor({ timeout: 5000 });
ok(true, '#1 erledigt → Bilal sieht „Erledigt“ live');
await rowByNum(anna, 1).locator('[role=switch]').click();
await rowByNum(anna, 1).locator('[role=switch][aria-checked=false]').waitFor();
ok(true, '#1 zurück auf Offen');

await rowByNum(anna, 2).locator('button[title^="Bearbeiten"]').click();
await anna.fill('#edit-details', 'تجديد جواز السفر');
await anna.selectOption('#edit-status', 'completed');
await anna.click('dialog button[type=submit]');
await anna.waitForSelector('text=#2 aktualisiert');
await rowByNum(bilal, 2).locator('text=تجديد جواز السفر').waitFor({ timeout: 5000 });
ok(true, 'Bearbeiten (arabische Details + Status) → live bei Bilal');

// Kopieren
await rowByNum(anna, 5).locator('button[title^="Nummer kopieren"]').click();
const clip = await anna.evaluate(() => navigator.clipboard.readText());
ok(clip === '0172 9998887', `Telefon kopiert (${clip})`);

// 5. Papierkorb
console.log('Papierkorb');
await rowByNum(anna, 3).locator('button[title^="Stornieren"]').click();
await anna.waitForSelector('text=storniert → Papierkorb');
await anna.waitForTimeout(300);
ok(!(await rowByNum(anna, 3).count()), '#3 verschwindet aus der Liste');
await bilal.click('nav button:has-text("Papierkorb")');
await rowByNum(bilal, 3).waitFor({ timeout: 5000 });
ok(true, '#3 im Papierkorb (Bilal, live)');
await rowByNum(bilal, 3).locator('button[title^="Wiederherstellen"]').click();
await anna.waitForSelector(`table tbody tr[data-seq="3"]`, { timeout: 5000 });
ok(true, 'Wiederhergestellt → #3 mit gleicher Nummer wieder in der Liste');
await rowByNum(anna, 3).locator('button[title^="Stornieren"]').click();
await rowByNum(bilal, 3).waitFor({ timeout: 5000 });
await rowByNum(bilal, 3).locator('button[title^="Endgültig"]').click();
await bilal.waitForSelector('dialog[open] >> text=endgültig löschen?');
ok(true, 'Endgültig löschen fragt nach');
await bilal.click('dialog[open] button:has-text("Endgültig löschen")');
await bilal.waitForSelector('text=#3 endgültig gelöscht');
ok(true, '#3 endgültig gelöscht');
await bilal.click('nav button:has-text("Anträge")');
await fill(anna, 'Nach Löschen', '0160 5555555');
await anna.press('#entry-phone', 'Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#8"))');
ok(true, 'Nächster Antrag ist #8 – #3 wird nie wieder vergeben');

// 6. Filter & Suche
console.log('Suche / Filter');
const search = anna.locator('input[type=search]');
await search.fill('سارة');
await anna.waitForTimeout(200);
ok(await anna.locator('table tbody tr').count() === 1, 'Suche nach arabischem Namen');
await search.fill('0172');
await anna.waitForTimeout(200);
ok(await anna.locator('table tbody tr').count() === 1, 'Suche nach Telefon');
await search.fill('Bruder');
await anna.waitForTimeout(200);
ok(await anna.locator('table tbody tr').count() === 1, 'Suche in Details');
await search.fill('');
await anna.click('[aria-label="Filter Kategorie"] >> text=وكالة');
ok(await anna.locator('table tbody tr').count() === 1, 'Kategorie-Filter وكالة');
await anna.click('[aria-label="Filter Kategorie"] >> text=Alle');
await anna.selectOption('select[aria-label=Status]', 'completed');
ok(await anna.locator('table tbody tr').count() === 1, 'Status-Filter Erledigt');
await anna.selectOption('select[aria-label=Status]', 'cancelled');
await anna.waitForTimeout(200);
ok(await anna.locator('table tbody tr').count() === 0, 'Status-Filter Storniert (leer nach Löschen)');
await anna.selectOption('select[aria-label=Status]', 'active');
await anna.click('text=الأحدث أولاً');
const firstNum = await anna.locator('table tbody tr td:first-child').first().textContent();
ok(firstNum.startsWith('#1'), `Sortierung älteste zuerst (${firstNum})`);
await anna.click('text=الأقدم أولاً');
await anna.click('[aria-label="Filter Datum"] >> text=Alle');
await anna.waitForTimeout(400);
ok(await anna.locator('table tbody tr').count() === 7, 'Datum „Alle“');
await anna.click('[aria-label="Filter Datum"] >> text=Heute');
await anna.screenshot({ path: `${SP}/desktop.png`, fullPage: true });

// 7. CSV
console.log('Export / Backup');
await anna.click('[aria-label=Menü]');
const [csvDl] = await Promise.all([anna.waitForEvent('download'), anna.click('text=CSV exportieren')]);
const csv = readFileSync(await csvDl.path(), 'utf8');
ok(csv.charCodeAt(0) === 0xfeff, 'CSV mit UTF-8-BOM');
ok(csv.includes('سارة علي') && csv.includes('Nummer;Name;Telefon;Kategorie;Details;Status;Datum'), 'CSV mit Kopfzeile und Arabisch');
ok(csv.includes('="0176 1234567"'), 'Telefon als Text für Excel');

// 8. Backup
await anna.click('[aria-label=Menü]');
const [bDl] = await Promise.all([anna.waitForEvent('download'), anna.click('text=Backup herunterladen')]);
const backupPath = `${SP}/backup.json`;
await bDl.saveAs(backupPath);
const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
ok(bDl.suggestedFilename().startsWith('applications-backup-') && backup.format === 'callerlog-backup', `Backup ${bDl.suggestedFilename()}`);
ok(backup.applications.length === 7 && backup.counter.last === 8, `Backup: ${backup.applications.length} Anträge, Zähler ${backup.counter.last}`);
await anna.waitForTimeout(800);
ok(!(await anna.isVisible('text=Wöchentliches Backup empfohlen')), 'Erinnerung verschwindet nach dem Backup');
ok(!(await bilal.isVisible('text=Wöchentliches Backup empfohlen')), '… auch auf Bilals Gerät');

// Nach dem Backup: stornieren + neuer Antrag, dann Backup zurückspielen
await rowByNum(anna, 5).locator('button[title^="Stornieren"]').click();
await fill(anna, 'Nach Backup', '0160 7777777');
await anna.press('#entry-phone', 'Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#9"))');

// 9. Restore
await anna.click('[aria-label=Menü]');
await anna.click('text=Backup wiederherstellen');
await anna.setInputFiles('dialog[open] input[type=file]', { name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"x"}') });
await anna.waitForSelector('text=Das ist keine Caller-Log-Sicherung');
ok(true, 'Ungültige Datei wird abgelehnt');
await anna.setInputFiles('dialog[open] input[type=file]', backupPath);
await anna.waitForSelector('text=Die Datenbank wird komplett ersetzt');
const restoreBtn = anna.locator('dialog[open] button:has-text("Ersetzen und wiederherstellen")');
ok(await restoreBtn.isDisabled(), 'Ohne „ERSETZEN“ kein Wiederherstellen');
await anna.fill('dialog[open] input:not([type=file])', 'ersetzen');
const [safety] = await Promise.all([anna.waitForEvent('download'), restoreBtn.click()]);
ok(safety.suggestedFilename().startsWith('applications-before-restore-'), 'Sicherheitskopie vor dem Ersetzen');
await anna.waitForSelector('text=Backup wiederhergestellt', { timeout: 15000 });
await anna.waitForTimeout(800);
ok(!(await rowByNum(anna, 9).count()), '#9 (nach dem Backup angelegt) ist weg');
ok((await rowByNum(anna, 5).count()) === 1, '#5 wieder aktiv (Stand des Backups)');
await rowByNum(bilal, 5).waitFor({ timeout: 5000 });
ok(!(await rowByNum(bilal, 9).count()), 'Bilal sieht den wiederhergestellten Stand live');
await fill(anna, 'Nach Restore', '0160 8888888');
await anna.press('#entry-phone', 'Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#10"))');
ok(true, 'Nach Restore: nächste Nummer #10 (Zähler nie kleiner, #9 nicht neu vergeben)');

// Offline
console.log('Offline');
await anna.context().setOffline(true);
await anna.waitForSelector('text=Offline – Änderungen');
ok(true, 'Offline-Hinweis erscheint');
await anna.click('[role=radio]:has-text("جواز")');
await anna.fill('#entry-name', 'Offline Person');
await anna.fill('#entry-phone', '0160 1212121');
await anna.press('#entry-phone', 'Enter');
await anna.waitForSelector('text=NICHT gespeichert');
ok((await anna.inputValue('#entry-name')) === 'Offline Person', 'Neuer Antrag offline: klare Meldung, Eingaben bleiben stehen');
await rowByNum(anna, 4).locator('[role=switch]').click();
await rowByNum(anna, 4).locator('[role=switch][aria-checked=true]').waitFor();
ok(true, 'Statuswechsel offline sofort sichtbar');
await anna.context().setOffline(false);
await rowByNum(bilal, 4).locator('[role=switch][aria-checked=true]').waitFor({ timeout: 20000 });
ok(true, 'Nach dem Wiederverbinden kommt der Statuswechsel bei Bilal an');
await anna.press('#entry-phone', 'Enter');
await anna.waitForSelector('[role=status]:has(b:text-is("#11"))', { timeout: 15000 });
ok(true, 'Wieder online: derselbe Antrag speichert als #11');

// 10. Druck + Responsive
console.log('Druck / Layout');
await anna.emulateMedia({ media: 'print' });
await anna.screenshot({ path: `${SP}/print.png`, fullPage: true });
ok(!(await anna.isVisible('#entry-name')), 'Druckansicht ohne Formular/Navigation');
await anna.emulateMedia({ media: 'screen' });
await bilal.screenshot({ path: `${SP}/ipad.png`, fullPage: true });
const phone = await login({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'bilal@amer.test');
await phone.waitForSelector('#entry-name');
await phone.waitForSelector('ul li[data-seq="1"]');
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
ok(!overflow, 'Handy: kein seitliches Scrollen');
await phone.screenshot({ path: `${SP}/phone.png`, fullPage: true });
const pdf = await anna.pdf({ path: `${SP}/print.pdf`, format: 'A4' }).catch(() => null);

await browser.close();
console.log(`Screenshots: ${SP}`);
console.log(failed === 0 ? '\nE2E: alles bestanden.' : `\nE2E: ${failed} fehlgeschlagen.`);
process.exit(failed ? 1 : 0);
