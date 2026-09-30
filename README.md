# Caller Log (Easy)

Schnelle Antragserfassung für das Büro von Amer Consulting.
**Öffnen → anmelden → Antrag eintippen → Enter → nächste Person.**

Ein kleines Werkzeug neben [Easy Consulting](https://github.com/lifeofnabel/EasyConsulting) und SADA:
eigenes Repository, aber **dasselbe Firebase-Projekt** (`easyconsulting60325`) – gleiche Konten,
gleiche Datenbank, ausgeliefert unter **https://easyconsulting60325.web.app/callerlog/**.

## Was es kann

| | |
|---|---|
| Erfassen | Kategorie (جواز · وطنية · وكالة, Tasten 1/2/3) → Name → Telefon → Details (optional) → Enter. Kategorie bleibt auf Wunsch stehen, Cursor springt zurück. |
| Nummern | `#1, #2, #3 …` fortlaufend, nie zurückgesetzt, nie wiederverwendet (auch nicht nach dem Löschen). Atomar per Firestore-Transaktion – zwei Mitarbeiter gleichzeitig bekommen nie dieselbe Nummer. |
| Duplikate | A: gleicher Name + Nummer + Kategorie → Warnung, Speichern nach Bestätigung · B: gleiche Person, andere Kategorie → Hinweis · C: andere Namen unter der Nummer → Hinweis „evtl. Familie“ · D: neue Nummer → nichts. Nummern werden vereinheitlicht (`+49 176…` = `0176…`), Namen tolerant verglichen (Groß/klein, Leerzeichen, arabische Schreibvarianten). |
| Liste | Heutige Anträge live auf allen Geräten. Suche (Name, Telefon, Details, #Nummer), Filter Kategorie/Datum/Status, Sortierung. Tabelle am Desktop, kompakte Liste auf Tablet/Handy. |
| Status | Schalter Offen ↔ Erledigt. Stornieren = Papierkorb. |
| Papierkorb | Wiederherstellen (gleiche Nummer, vorheriger Status) oder endgültig löschen (mit Rückfrage). |
| Export | CSV für Excel (UTF-8 mit BOM, Semikolon, Arabisch korrekt) der aktuell angezeigten Liste. Druckansicht A4. |
| Backup | JSON mit **allem** (alle Anträge inkl. Papierkorb, alle Felder, Zählerstand). Erinnerung ab Montag, bis in der Woche jemand ein Backup geladen hat (gilt für alle Geräte; „Später“ blendet sie auf dem Gerät für die Woche aus). |
| Wiederherstellen | Datei wählen → wird geprüft → Zusammenfassung → `ERSETZEN` tippen. Ersetzt die Datenbank **komplett** durch den Stand der Datei. Vorher lädt die App automatisch eine Sicherheitskopie des aktuellen Stands herunter. Der Zähler wird nie kleiner. |
| Offline | Liste bleibt sichtbar (lokaler Zwischenspeicher), Statuswechsel und Änderungen werden nachgereicht. Neue Anträge brauchen eine Verbindung (wegen der Nummer) – ohne Netz gibt es eine klare Meldung, die Eingaben bleiben stehen. |

Bewusst **nicht** enthalten: Rollen, Rechteverwaltung, Kundenprofile, Dashboards, Einstellungen.

## Zugang

Jedes **aktive Mitarbeiterprofil aus Easy Consulting** (`users/{uid}.active == true`) – egal ob
Mitarbeiter, Manager oder Admin. Neue Leute also wie gewohnt in Easy Consulting unter „Mitarbeiter“
einladen; nach ihrer ersten Anmeldung dort können sie auch Caller Log öffnen.
Wer in Easy Consulting angemeldet ist, ist es hier automatisch auch (gleiche Adresse).

## Daten (Firestore)

Alles unter eigenen Collections, nichts kollidiert mit Easy Consulting oder SADA:

```
callerlog_applications/{nummer}   ein Antrag, Dokument-ID = Nummer ("17")
  sequenceNumber, name, nameKey, phone, phoneKey, category (passport|id|poa),
  details, status (open|completed|cancelled), previousStatus, receivedAt, day (JJJJ-MM-TT),
  createdAt, createdBy{uid,name}, updatedAt, updatedBy{uid,name}, cancelledAt
callerlog_meta/counter            { last }  höchste je vergebene Nummer – wird nie kleiner
callerlog_meta/backup             { lastWeek, lastAt, lastBy }  für die Wochen-Erinnerung
```

Regeln: `rules/firestore.callerlog.rules`. Sie werden – wie bei SADA – als Block zwischen
`// >>> CALLERLOG` und `// <<< CALLERLOG` in die `firestore.rules` von Easy Consulting eingesetzt.
Kein zusätzlicher Index nötig.

## Entwicklung

```bash
npm install
cp .env.example .env        # dieselben VITE_FIREBASE_*-Werte wie EasyConsulting/.env
npm run dev                 # http://localhost:5174/callerlog/
```

Lokal mit Emulatoren statt echter Datenbank (Java nötig):

```bash
npm run ec:rules -- --emulator   # EC-Regeln + Caller-Log-Block → .emulator/firestore.rules
npm run emulators                # Auth + Firestore
VITE_USE_EMULATORS=true npm run dev
npm run test:rules               # Regeln + 40 gleichzeitige Anträge
npm run test:e2e                 # kompletter Browser-Durchlauf (löscht Emulator-Daten!)
```

## Veröffentlichen (wie SADA)

Einmalig bzw. bei Regeländerungen:

```bash
npm run ec:rules                                   # Block in EasyConsulting/firestore.rules
cd ../EasyConsulting && firebase deploy --only firestore:rules
```

Bei jeder neuen Version:

```bash
npm run ec:publish          # baut nach EasyConsulting/public/callerlog (liest dessen .env)
cd ../EasyConsulting
git add public/callerlog && git commit -m "Caller-Log-Oberfläche <commit>"
npm run build && firebase deploy --only hosting    # oder push auf main → GitHub Actions
```

Die Skripte finden Easy Consulting unter `../EasyConsulting`, `~/StudioProjects/EasyConsulting`
oder über `EASYCONSULTING_DIR`.

### jajehelp.com/callerlog

`deploy/jajehelp/callerlog/index.html` in den jajehelp-Ordner kopieren (→ `jajehelp/callerlog/index.html`)
und pushen. Die Seite leitet auf die App unter Easy Consulting weiter – Anmeldung und Daten bleiben dort.

## Aufbau

```
src/
  components/   Formular, Liste, Dialoge, Filter, UI-Bausteine
  pages/        Anmeldung, Anträge, Papierkorb
  hooks/        Live-Listen, Duplikat-Abfrage, Zeilenaktionen, Backup-Erinnerung
  lib/          Firebase, Anmeldung
  services/     Anträge (inkl. Nummernvergabe), Duplikate, Backup/Restore, CSV
  types/ utils/
rules/          Firestore-Regelblock (+ Platzhalter für den Emulator)
scripts/        ec:rules, ec:publish, Tests
```
