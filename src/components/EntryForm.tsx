import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { CategoryPicker } from './CategoryPicker';
import { useToast } from './Toast';
import { Bi, Button, FieldLabel, TextInput, cx, inputClass } from './ui';
import { usePhoneMatches } from '@/hooks/usePhoneMatches';
import { useAuth } from '@/lib/auth';
import { createApplication, isTimeout, validateInput } from '@/services/applications';
import { evaluateDuplicates } from '@/services/duplicates';
import { CATEGORY_LABELS, STATUS_LABELS, type Category } from '@/types/application';
import { formatDate, fromLocalInput } from '@/utils/dates';
import { typingPhone } from '@/utils/phone';

const KEEP_KEY = 'callerlog:keep-category';

function readKeep(): { keep: boolean; category: Category | null } {
  try {
    const raw = window.localStorage.getItem(KEEP_KEY);
    if (raw === null) return { keep: true, category: null };
    const parsed = JSON.parse(raw) as { keep?: boolean; category?: Category | null };
    return { keep: parsed.keep !== false, category: parsed.keep === false ? null : (parsed.category ?? null) };
  } catch {
    return { keep: true, category: null };
  }
}

function writeKeep(keep: boolean, category: Category | null): void {
  try {
    window.localStorage.setItem(KEEP_KEY, JSON.stringify({ keep, category }));
  } catch {
    /* nur Komfort */
  }
}

/**
 * Erfassung: Kategorie → Name → Telefon → Details (optional) → Speichern.
 * Enter speichert aus jedem Feld. Nach dem Speichern leert sich das Formular, die Kategorie bleibt
 * auf Wunsch stehen und der Cursor springt zurück an den Anfang.
 */
export function EntryForm({ onSaved }: { onSaved?: (sequenceNumber: number) => void }): JSX.Element {
  const { user } = useAuth();
  const toast = useToast();
  const initial = useMemo(readKeep, []);
  const [category, setCategory] = useState<Category | null>(initial.category);
  const [keepCategory, setKeepCategory] = useState(initial.keep);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [when, setWhen] = useState('');
  const [showWhen, setShowWhen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExact, setConfirmExact] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const categoryRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);

  const { matches, resolve: resolveMatches } = usePhoneMatches(phone, refresh);
  const duplicate = useMemo(
    () => (category === null ? null : evaluateDuplicates(matches, name, category)),
    [matches, name, category],
  );

  // Erste Eingabe: dorthin, wo es losgeht.
  useEffect(() => {
    focusStart(initial.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jede Änderung an den Kernfeldern verwirft eine bereits gezeigte Duplikat-Bestätigung.
  useEffect(() => setConfirmExact(false), [name, phone, category]);
  useEffect(() => {
    if (confirmExact) confirmRef.current?.focus();
  }, [confirmExact]);

  function focusStart(cat: Category | null) {
    if (cat === null) {
      const checked = categoryRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]');
      checked?.focus();
    } else nameRef.current?.focus();
  }

  async function save(force: boolean) {
    if (submitting.current || user === null) return;
    const input = { name, phone, category: category ?? ('' as Category), details, receivedAt: fromLocalInput(when) };
    const problem = validateInput(input);
    if (problem !== null) {
      setError(problem);
      if (category === null) focusStart(null);
      else if (name.trim() === '') nameRef.current?.focus();
      else phoneRef.current?.focus();
      return;
    }
    if (!force) {
      submitting.current = true;
      const current = evaluateDuplicates(await resolveMatches(), name, category!);
      submitting.current = false;
      if (current.kind === 'exact') {
        setConfirmExact(true);
        return;
      }
    }
    if (!navigator.onLine) {
      setError('Keine Internetverbindung – der Antrag wurde NICHT gespeichert. Eingaben bleiben stehen.');
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const seq = await createApplication({ ...input, category: category! }, user);
      toast(
        <span>
          <b className="num text-accent">#{seq}</b> gespeichert · <span className="ar">تم الحفظ</span>
        </span>,
      );
      setLastSaved(seq);
      onSaved?.(seq);
      const nextCategory = keepCategory ? category : null;
      setName('');
      setPhone('');
      setDetails('');
      setWhen('');
      setShowWhen(false);
      setConfirmExact(false);
      setCategory(nextCategory);
      setRefresh((n) => n + 1);
      writeKeep(keepCategory, nextCategory);
      window.setTimeout(() => focusStart(nextCategory), 0);
    } catch (err) {
      setError(
        isTimeout(err)
          ? 'Keine Antwort vom Server. Bitte in der Liste prüfen, ob der Antrag angekommen ist, bevor du erneut speicherst.'
          : 'Speichern fehlgeschlagen – der Antrag wurde NICHT gespeichert. Eingaben bleiben stehen, bitte erneut versuchen.',
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save(confirmExact);
  };

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void save(confirmExact);
        }
      }}
      className="no-print rounded-lg border border-line bg-surface"
      aria-label="Neuer Antrag"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          <Bi de="Neuer Antrag" ar="طلب جديد" />
        </h2>
        <div className="flex items-center gap-4 text-xs text-faint">
          {lastSaved !== null && (
            <span>
              Zuletzt: <b className="num text-fg">#{lastSaved}</b>
            </span>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 select-none">
            <input
              type="checkbox"
              checked={keepCategory}
              onChange={(e) => {
                setKeepCategory(e.target.checked);
                writeKeep(e.target.checked, category);
              }}
              className="accent-[var(--color-accent-strong)]"
            />
            Kategorie behalten
          </label>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <div>
          <FieldLabel de="Kategorie" ar="الفئة" hint="1 · 2 · 3" />
          <CategoryPicker
            ref={categoryRef}
            value={category}
            onChange={(c) => {
              setCategory(c);
              setError(null);
            }}
            onPicked={() => nameRef.current?.focus()}
          />
        </div>

        <div>
          <FieldLabel htmlFor="entry-name" de="Name" ar="الاسم" />
          <TextInput
            ref={nameRef}
            id="entry-name"
            dir="auto"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vor- und Nachname · الاسم الكامل"
          />
        </div>

        <div>
          <FieldLabel htmlFor="entry-phone" de="Telefon" ar="رقم الهاتف" />
          <TextInput
            ref={phoneRef}
            id="entry-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(typingPhone(e.target.value))}
            placeholder="0176 …"
            className="num"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-2 xl:col-span-1">
          <FieldLabel
            htmlFor="entry-details"
            de="Details"
            ar="تفاصيل الطلب"
          />
          <div className="flex gap-2">
            <TextInput
              id="entry-details"
              dir="auto"
              autoComplete="off"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="optional · اختياري"
            />
            {showWhen ? (
              <input
                type="datetime-local"
                aria-label="Datum und Uhrzeit"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className={cx(inputClass, 'num w-[12.5rem] shrink-0 px-2')}
              />
            ) : (
              <Button
                variant="ghost"
                size="md"
                className="px-2.5 text-xs"
                onClick={() => setShowWhen(true)}
                title="Anderes Datum / Uhrzeit (Standard: jetzt)"
              >
                Datum
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-end md:col-span-2 lg:col-span-1">
          <Button type="submit" variant="primary" className="w-full xl:w-auto xl:min-w-[7.5rem]" disabled={saving}>
            {saving ? 'Speichert …' : <Bi de="Speichern" ar="حفظ" />}
          </Button>
        </div>
      </div>

      {(error !== null || (duplicate !== null && duplicate.kind !== 'none')) && (
        <div className="space-y-2 px-4 pb-4" aria-live="polite">
          {error !== null && (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-fg">
              {error}
            </p>
          )}
          {duplicate?.kind === 'exact' && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-[13px]">
              <span className="font-semibold text-warn">
                <Bi de="Doppelt?" ar="طلب مكرر؟" />
              </span>
              <span className="text-fg">
                Gleicher Name, gleiche Nummer, gleiche Kategorie existiert schon:{' '}
                {duplicate.exact.map((a) => (
                  <b key={a.id} className="num mr-1.5">
                    #{a.sequenceNumber} ({formatDate(a.receivedAt)}, {STATUS_LABELS[a.status].de})
                  </b>
                ))}
              </span>
              {confirmExact ? (
                <Button ref={confirmRef} variant="warn" size="sm" onClick={() => void save(true)} disabled={saving}>
                  Trotzdem speichern (Enter)
                </Button>
              ) : (
                <span className="text-faint">Speichern fragt noch einmal nach.</span>
              )}
            </div>
          )}
          {duplicate?.kind === 'service' && (
            <p className="rounded-md border border-info/30 bg-info-soft px-3 py-2 text-[13px]">
              <span className="font-semibold text-info">Bekannter Kunde · عميل سابق</span> – schon da mit{' '}
              {[...new Set(duplicate.sameName.map((a) => a.category))].map((c) => (
                <span key={c} className="ar mx-1 font-semibold">
                  {CATEGORY_LABELS[c].ar}
                </span>
              ))}
              . Neue Leistung wird normal gespeichert.
            </p>
          )}
          {duplicate !== null && duplicate.kind !== 'exact' && duplicate.otherNames.length > 0 && (
            <p className="rounded-md border border-line-strong bg-raised px-3 py-2 text-[13px] text-muted">
              <span className="font-semibold text-fg">Nummer bekannt · الرقم مسجل</span> – gehört auch zu:{' '}
              {duplicate.otherNames.slice(0, 5).map((n) => (
                <span key={n} dir="auto" className="auto-dir mr-2 font-medium text-fg">
                  {n}
                </span>
              ))}
              (evtl. Familie)
            </p>
          )}
        </div>
      )}
    </form>
  );
}
