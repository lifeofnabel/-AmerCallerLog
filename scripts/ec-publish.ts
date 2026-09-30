// Baut Caller Log für die Auslieferung unter Easy Consulting: https://<easy-consulting>/callerlog/
// Nutzt dieselbe Firebase-Konfiguration wie Easy Consulting (dessen .env) – dadurch teilen sich beide die Anmeldung.
// Ausgabe: <EasyConsulting>/public/callerlog/ – der normale Build von Easy Consulting übernimmt sie nach dist/callerlog/.
// Der Ordner wird in Easy Consulting eingecheckt, damit jeder Hosting-Deploy (auch per GitHub Actions) Caller Log mitnimmt.
// build.json ist zugleich das Signal für Easy Consulting, den Link auf Caller Log anzuzeigen.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CALLERLOG_ROOT, requireEcDir } from './ec';

const ec = requireEcDir();
const envFile = join(ec, '.env');
if (!existsSync(envFile)) {
  console.error(`Keine .env in ${ec} – ohne Firebase-Konfiguration lässt sich Caller Log nicht bauen.`);
  process.exit(1);
}
const vars = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => /^\s*(VITE_FIREBASE_[A-Z_]+)\s*=\s*(.*)\s*$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [m[1]!, m[2]!.replace(/^["']|["']$/g, '')]),
);
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) {
  if (!vars[key]) {
    console.error(`${key} fehlt in ${envFile}.`);
    process.exit(1);
  }
}

const git = (cmd: string) => execSync(`git ${cmd}`, { cwd: CALLERLOG_ROOT, encoding: 'utf8' }).trim();
const commit = git('rev-parse --short HEAD');
const dirty = git('status --porcelain --untracked-files=no') !== '';
if (dirty) console.warn('Hinweis: Caller Log hat nicht eingecheckte Änderungen – der Build ist als „dirty“ markiert.\n');

const outDir = join(ec, 'public', 'callerlog');
execSync(`npx tsc -b && npx vite build --outDir "${outDir}" --emptyOutDir`, {
  cwd: CALLERLOG_ROOT,
  stdio: 'inherit',
  env: { ...process.env, ...vars, VITE_USE_EMULATORS: 'false' },
});
writeFileSync(
  join(outDir, 'build.json'),
  `${JSON.stringify({ app: 'callerlog', commit, dirty, builtAt: new Date().toISOString() }, null, 2)}\n`,
);

console.log(`
Caller Log ${commit}${dirty ? ' (dirty)' : ''} gebaut nach ${outDir}
Nächste Schritte im Easy-Consulting-Ordner:
  git add public/callerlog && git commit -m "Caller-Log-Oberfläche ${commit}"
  npm run build && firebase deploy --only hosting     (oder push auf main → GitHub Actions)`);
