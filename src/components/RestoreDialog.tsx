import { useRef, useState } from 'react';

import { useToast } from './Toast';
import { Bi, Button, Dialog, TextInput } from './ui';
import { useAuth } from '@/lib/auth';
import { checkBackup, downloadBackup, restoreBackup, type BackupCheck } from '@/services/backup';
import { formatDateTime } from '@/utils/dates';

const CONFIRM_WORD = 'ERSETZEN';

/**
 * Backup wiederherstellen: Datei wählen → prüfen → Zusammenfassung → „ERSETZEN“ tippen → los.
 * Vor dem Ersetzen wird der aktuelle Stand automatisch als Sicherheitskopie heruntergeladen.
 */
export function RestoreDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFileName('');
    setCheck(null);
    setWord('');
    setProgress(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    setCheck(checkBackup(await file.text()));
  }

  async function run() {
    if (check?.backup == null || user === null) return;
    setBusy(true);
    setError(null);
    try {
      setProgress('Sicherheitskopie des aktuellen Stands …');
      await downloadBackup(user, 'applications-before-restore');
      setProgress('Stelle wieder her …');
      const result = await restoreBackup(check.backup, (done, total) => setProgress(`Stelle wieder her … ${done}/${total}`));
      toast(`Backup wiederhergestellt: ${result.written} Anträge. Nächste Nummer: #${result.counter + 1}`);
      setBusy(false);
      reset();
      onClose();
    } catch (err) {
      setBusy(false);
      setProgress(null);
      setError(
        `Wiederherstellung abgebrochen (${(err as Error).message}). Die Sicherheitskopie wurde heruntergeladen – bitte erneut versuchen.`,
      );
    }
  }

  const s = check?.summary;
  return (
    <Dialog open={open} onClose={close} title={<Bi de="Backup wiederherstellen" ar="استعادة النسخة الاحتياطية" />}>
      <div className="space-y-4 text-[13px]">
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="block w-full text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-fg hover:file:bg-hover"
            disabled={busy}
          />
          {fileName !== '' && <p className="mt-1 text-faint">{fileName}</p>}
        </div>

        {check !== null && !check.ok && (
          <div role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2">
            <p className="font-semibold">Datei ungültig – nichts wurde geändert.</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {check.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {check?.ok && check.backup !== null && s !== undefined && (
          <>
            <div className="rounded-md border border-line bg-raised px-3 py-2.5">
              <p>
                Stand vom <b>{formatDateTime(new Date(check.backup.exportedAt))}</b>
                {check.backup.exportedBy.name !== '' && <> · {check.backup.exportedBy.name}</>}
              </p>
              <p className="mt-1 text-muted">
                <b className="text-fg">{s.total}</b> Anträge ({s.open} offen, {s.completed} erledigt, {s.cancelled} storniert) · höchste
                Nummer <b className="num text-fg">#{s.maxSeq}</b>
              </p>
            </div>
            <div className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2.5">
              <p className="font-semibold text-warn">Achtung: Die Datenbank wird komplett ersetzt.</p>
              <p className="mt-1 text-muted">
                Alle Anträge, die nicht in dieser Datei stehen, werden gelöscht. Vorher wird der aktuelle Stand automatisch
                heruntergeladen. Neue Anträge bekommen danach trotzdem nie eine schon vergebene Nummer.
              </p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-muted">
                Zum Bestätigen <b className="text-fg">{CONFIRM_WORD}</b> eintippen:
              </span>
              <TextInput value={word} onChange={(e) => setWord(e.target.value)} disabled={busy} autoComplete="off" />
            </label>
          </>
        )}

        {progress !== null && <p className="text-muted">{progress}</p>}
        {error !== null && (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="danger" disabled={busy || !check?.ok || word.trim().toUpperCase() !== CONFIRM_WORD} onClick={() => void run()}>
            {busy ? 'Läuft …' : 'Ersetzen und wiederherstellen'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
