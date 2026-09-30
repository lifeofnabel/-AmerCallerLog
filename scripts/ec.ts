// Ort des Easy-Consulting-Projekts (Caller Log wird dort ausgeliefert und teilt dessen Datenbank).
// Reihenfolge: Umgebungsvariable EASYCONSULTING_DIR, dann übliche Ablageorte.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

export function findEcDir(): string | null {
  const candidates = [
    process.env.EASYCONSULTING_DIR,
    resolve(ROOT, '..', 'EasyConsulting'),
    resolve(ROOT, '..', 'easyconsulting'),
    join(homedir(), 'StudioProjects', 'EasyConsulting'),
    join(homedir(), 'OneDrive', 'Document', 'EasyConsulting'),
    join(homedir(), 'OneDrive', 'Documents', 'EasyConsulting'),
  ].filter((p): p is string => !!p);
  return (
    candidates.find((dir) => existsSync(join(dir, 'firebase.json')) && existsSync(join(dir, 'src', 'lib', 'auth.tsx'))) ?? null
  );
}

export function requireEcDir(): string {
  const dir = findEcDir();
  if (!dir) {
    console.error(
      'Easy-Consulting-Ordner nicht gefunden. Bitte EASYCONSULTING_DIR setzen, z. B.:\n  $env:EASYCONSULTING_DIR = "C:\\Pfad\\zu\\EasyConsulting"',
    );
    process.exit(1);
  }
  return dir;
}

export const CALLERLOG_ROOT = ROOT;
