import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { CategoryPicker } from './CategoryPicker';
import { DuplicateNotice } from './DuplicateNotice';
import { useToast } from './Toast';
import { Bi, Button, FieldLabel, TextInput, cx, inputClass } from './ui';
import { usePhoneMatches } from '@/hooks/usePhoneMatches';
import { useRules } from '@/hooks/useRules';
import { useAuth } from '@/lib/auth';
import { createApplication, isTimeout, validateInput } from '@/services/applications';
import { evaluateDuplicates, NO_DUPLICATE } from '@/services/duplicates';
import type { Application, Category } from '@/types/application';
import { dayKey, formatTime } from '@/utils/dates';
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

/** Datum/Uhrzeit: läuft mit der Uhr mit, bis jemand es von Hand ändert. */
function useNowFields() {
  const [touched, setTouched] = useState(false);
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    if (touched) return;
    const tick = () => {
      const now = new Date();
      setDate(dayKey(now));
      setTime(formatTime(now));
    };
    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, [touched]);
  return {
    date,
    time,
    touched,
    setDate: (v: string) => {
      setTouched(true);
      setDate(v);
    },
    setTime: (v: string) => {
      setTouched(true);
      setTime(v);
    },
    /** null = „jetzt“ beim Speichern */
    value(): Date | null {
      if (!touched) return null;
      const d = new Date(`${date}T${time || '00:00'}`);
      return Number.isNaN(d.getTime()) ? null : d;
    },
    reset: () => setTouched(false),
  };
}

/**
 * Erfassung (rechts nach links): Kategorie → Name → Telefon → Details → Datum → Uhrzeit → Speichern.
 * Tab springt von Feld zu Feld, Enter speichert aus jedem Feld. Nach dem Speichern leert sich das
 * Formular, die Kategorie bleibt auf Wunsch stehen und der Cursor springt zurück an den Anfang.
 */
export function EntryForm({ onSaved }: { onSaved?: (app: Application) => void }): JSX.Element {
  const { user } = useAuth();
  const rules = useRules();
  const toast = useToast();
  const initial = useMemo(readKeep, []);
  const [category, setCategory] = useState<Category | null>(initial.category);
  const [keepCategory, setKeepCategory] = useState(initial.keep);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const when = useNowFields();
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
    () => (category === null ? NO_DUPLICATE : evaluateDuplicates(matches, name, category, rules)),
    [matches, name, category, rules],
  );

  useEffect(() => {
    focusStart(initial.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jede Änderung an den Kernfeldern verwirft eine bereits gezeigte Bestätigung.
  useEffect(() => setConfirmExact(false), [name, phone, category]);
  useEffect(() => {
    if (confirmExact) confirmRef.current?.focus();
  }, [confirmExact]);

  function focusStart(cat: Category | null) {
    if (cat === null) categoryRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();
    else nameRef.current?.focus();
  }

  async function save(force: boolean) {
    if (submitting.current || user === null) return;
    const input = { name, phone, category: category ?? ('' as Category), details, receivedAt: when.value() };
    const problem = validateInput(input);
    if (problem !== null) {
      setError(problem);
      if (category === null) focusStart(null);
      else if (name.trim() === '') nameRef.current?.focus();
      else phoneRef.current?.focus();
      return;
    }
    submitting.current = true;
    const current = evaluateDuplicates(await resolveMatches(), name, category!, rules);
    submitting.current = false;
    if (current.block === 'hard') {
      setError(null);
      return;
    }
    if (current.block === 'soft' && !force) {
      setConfirmExact(true);
      return;
    }
    if (!navigator.onLine) {
      setError('Keine Internetverbindung – der Antrag wurde NICHT gespeichert. Eingaben bleiben stehen.');
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const app = await createApplication({ ...input, category: category! }, user);
      toast(
        <span>
          <b className="num ltr text-accent">#{app.sequenceNumber}</b> <span className="ar">تم الحفظ</span> · gespeichert
        </span>,
      );
      setLastSaved(app.sequenceNumber);
      onSaved?.(app);
      const nextCategory = keepCategory ? category : null;
      setName('');
      setPhone('');
      setDetails('');
      when.reset();
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

  const blocked = duplicate.block === 'hard';

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save(confirmExact);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && confirmExact) {
          setConfirmExact(false);
          nameRef.current?.focus();
        }
      }}
      className="no-print rounded-xl border border-line bg-surface shadow-sm"
      aria-label="طلب جديد"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-[15px] font-semibold">
          <Bi de="Neuer Antrag" ar="طلب جديد" />
        </h2>
        {lastSaved !== null && (
          <span className="text-xs text-faint">
            <span className="ar">آخر طلب</span> · <span className="ltr">Zuletzt <b className="num text-fg">#{lastSaved}</b></span>
          </span>
        )}
      </div>

      <div className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)]">
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
            placeholder="الاسم الكامل"
            className="text-[15px]"
          />
        </div>

        <div>
          <FieldLabel htmlFor="entry-phone" de="Telefon" ar="رقم الهاتف" />
          <TextInput
            ref={phoneRef}
            id="entry-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(typingPhone(e.target.value))}
            placeholder="0176 …"
            className="num text-end text-[15px]"
          />
        </div>

      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_13rem]">
        <div>
          <FieldLabel htmlFor="entry-details" de="Details (optional)" ar="تفاصيل الطلب" />
          <TextInput
            id="entry-details"
            dir="auto"
            autoComplete="off"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="اختياري"
          />
        </div>

        <div>
          <FieldLabel de={when.touched ? 'Datum / Uhrzeit' : 'Datum / Uhrzeit · jetzt'} ar="التاريخ والوقت" />
          <div className="flex gap-2" dir="ltr">
            <input
              type="date"
              aria-label="التاريخ Datum"
              value={when.date}
              onChange={(e) => when.setDate(e.target.value)}
              className={cx(inputClass, 'num min-w-0 flex-1 px-2 md:w-[9.5rem] md:flex-none', !when.touched && 'text-muted')}
            />
            <input
              type="time"
              aria-label="الوقت Uhrzeit"
              value={when.time}
              onChange={(e) => when.setTime(e.target.value)}
              className={cx(inputClass, 'num w-[6.5rem] shrink-0 px-2', !when.touched && 'text-muted')}
            />
          </div>
        </div>

        <div className="flex flex-col justify-end gap-2 md:col-span-2 lg:col-span-1">
          <Button type="submit" variant="primary" className="h-11 w-full justify-center text-[15px]" disabled={saving || blocked}>
            {saving ? '…' : <Bi de="Speichern · Enter" ar="حفظ" />}
          </Button>
        </div>
      </div>
      </div>

      {(error !== null || duplicate.exact.length + duplicate.sameCategory.length + duplicate.otherCategory.length > 0) && (
        <div className="space-y-2 px-4 pb-4" aria-live="polite">
          {error !== null && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-2.5 text-[14px] text-fg">
              {error}
            </p>
          )}
          <DuplicateNotice
            ref={confirmRef}
            result={duplicate}
            confirmPending={confirmExact}
            onOverride={() => void save(true)}
            saving={saving}
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-faint">
        <span>
          <span className="ar">Tab للتنقل · Enter للحفظ</span> · <span className="ltr">Tab = weiter, Enter = speichern</span>
        </span>
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
          <span className="ar">إبقاء الفئة</span> · <span className="ltr">Kategorie behalten</span>
        </label>
      </div>
    </form>
  );
}
