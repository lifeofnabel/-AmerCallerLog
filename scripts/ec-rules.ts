// Setzt den Caller-Log-Regelblock (rules/firestore.callerlog.rules) in die Firestore-Regeln von Easy Consulting ein.
//   npm run ec:rules               → schreibt in den Easy-Consulting-Ordner (danach dort deployen)
//   npm run ec:rules -- --emulator → erzeugt .emulator/firestore.rules für den lokalen Emulator
// Der Block steht zwischen „// >>> CALLERLOG“ und „// <<< CALLERLOG“ und wird bei jedem Lauf ersetzt – nie doppelt.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CALLERLOG_ROOT, findEcDir, requireEcDir } from './ec';

const BEGIN = '// >>> CALLERLOG';
const END = '// <<< CALLERLOG';
const CATCH_ALL = /^[ \t]*match \/\{document=\*\*\} \{/gm;
const EMULATOR = process.argv.includes('--emulator');

export function withBlock(target: string, block: string, indent = '    '): string {
  const body = block
    .trimEnd()
    .split('\n')
    .map((line) => (line.trim() ? indent + line : ''))
    .join('\n');
  const section = `${indent}${BEGIN} – automatisch aus AmerCallerLog/rules eingefügt, bitte nicht von Hand ändern\n${body}\n${indent}${END}\n`;

  const lines = target.split('\n');
  const start = lines.findIndex((l) => l.includes(BEGIN));
  if (start >= 0) {
    const end = lines.findIndex((l, i) => i > start && l.includes(END));
    if (end < 0) throw new Error(`Ende-Markierung „${END}“ fehlt.`);
    lines.splice(start, end - start + 1, ...section.trimEnd().split('\n'));
    return lines.join('\n');
  }
  // Erstes Einfügen: direkt vor der abschließenden „alles andere gesperrt“-Regel samt ihrer Kommentarzeilen.
  const last = [...target.matchAll(CATCH_ALL)].at(-1);
  if (!last || last.index === undefined) throw new Error('Abschließende Sperr-Regel nicht gefunden – bitte Block von Hand einfügen.');
  const before = target.slice(0, target.lastIndexOf('\n', last.index) + 1).split('\n');
  before.pop();
  while (before.length && /^\s*\/\//.test(before.at(-1)!)) before.pop();
  const lineStart = before.length ? before.join('\n').length + 1 : 0;
  return `${target.slice(0, lineStart)}${section}\n${target.slice(lineStart)}`;
}

const block = readFileSync(join(CALLERLOG_ROOT, 'rules', 'firestore.callerlog.rules'), 'utf8');

if (EMULATOR) {
  const ec = findEcDir();
  const base = readFileSync(ec ? join(ec, 'firestore.rules') : join(CALLERLOG_ROOT, 'rules', 'ec-stub.firestore.rules'), 'utf8');
  mkdirSync(join(CALLERLOG_ROOT, '.emulator'), { recursive: true });
  writeFileSync(join(CALLERLOG_ROOT, '.emulator', 'firestore.rules'), withBlock(base, block));
  console.log(`Emulator-Regeln erzeugt aus ${ec ? `Easy Consulting (${ec})` : 'dem Platzhalter'} + Caller-Log-Block.`);
} else {
  const path = join(requireEcDir(), 'firestore.rules');
  const before = readFileSync(path, 'utf8');
  const after = withBlock(before, block);
  if (after === before) console.log('firestore.rules: unverändert');
  else {
    writeFileSync(path, after);
    console.log(`firestore.rules: Caller-Log-Block aktualisiert (${path})`);
  }
  console.log('Nächster Schritt im Easy-Consulting-Ordner: firebase deploy --only firestore:rules');
}
