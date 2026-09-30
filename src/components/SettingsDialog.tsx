import { useEffect, useState } from 'react';

import { useToast } from './Toast';
import { Bi, Button, Dialog, cx } from './ui';
import { useRules } from '@/hooks/useRules';
import { useAuth } from '@/lib/auth';
import { DEFAULT_RULES, saveRules, type Rules } from '@/services/settings';

function Choice<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; ar: string; de: string }>;
  name: string;
}): JSX.Element {
  return (
    <div role="radiogroup" aria-label={name} className="mt-2 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <label
          key={o.value}
          className={cx(
            'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors',
            value === o.value ? 'border-accent/60 bg-accent-soft text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg',
          )}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="accent-[var(--color-accent-strong)]"
          />
          <Bi ar={o.ar} de={o.de} />
        </label>
      ))}
    </div>
  );
}

function Rule({ title, de, children }: { title: string; de: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="rounded-lg border border-line bg-raised px-4 py-3">
      <h3 className="text-[14px] font-semibold">
        <Bi ar={title} de={de} />
      </h3>
      {children}
    </section>
  );
}

/** Regeln für die Prüfung beim Erfassen. Gelten sofort für alle Geräte. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const current = useRules();
  const { user } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Rules>(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(current);
  }, [open, current]);

  const set = <K extends keyof Rules>(key: K, value: Rules[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    if (user === null) return;
    setSaving(true);
    try {
      await saveRules(draft, user);
      toast(<Bi ar="تم حفظ الإعدادات" de="Einstellungen gespeichert – gilt für alle" />);
      onClose();
    } catch {
      toast('Einstellungen konnten nicht gespeichert werden.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={<Bi ar="الإعدادات – قواعد التحقق" de="Einstellungen · Prüfregeln" />} width="max-w-2xl">
      <div className="space-y-3 text-[13px]">
        <p className="text-muted">
          <span className="ar">تنطبق على جميع الأجهزة فوراً.</span> · Gilt sofort für alle Mitarbeiter und Geräte.
        </p>

        <Rule title="كل شيء مطابق (الرقم + الاسم + الفئة)" de="Alles gleich: Nummer + Name + Kategorie">
          <Choice
            name="exact"
            value={draft.exact}
            onChange={(v) => set('exact', v)}
            options={[
              { value: 'block', ar: 'منع مع استثناء', de: 'Sperren, Ausnahme möglich' },
              { value: 'hard', ar: 'منع تام', de: 'Hart sperren' },
              { value: 'hint', ar: 'تنبيه فقط', de: 'Nur Hinweis' },
              { value: 'off', ar: 'إيقاف', de: 'Aus' },
            ]}
          />
          <p className="mt-3 text-xs text-faint">
            <Bi ar="أي طلبات سابقة تُحسب؟" de="Welche früheren Anträge zählen?" />
          </p>
          <Choice
            name="exactScope"
            value={draft.exactScope}
            onChange={(v) => set('exactScope', v)}
            options={[
              { value: 'always', ar: 'دائماً', de: 'Immer' },
              { value: 'open', ar: 'المفتوحة فقط', de: 'Nur offene' },
              { value: 'days30', ar: 'آخر ٣٠ يوماً', de: 'Letzte 30 Tage' },
            ]}
          />
        </Rule>

        <Rule title="نفس الرقم ونفس الفئة، اسم آخر" de="Gleiche Nummer + Kategorie, anderer Name (Familie?)">
          <Choice
            name="sameCategory"
            value={draft.sameCategory}
            onChange={(v) => set('sameCategory', v)}
            options={[
              { value: 'hint', ar: 'تنبيه', de: 'Hinweis' },
              { value: 'off', ar: 'إيقاف', de: 'Aus' },
            ]}
          />
        </Rule>

        <Rule title="نفس الرقم، فئة أخرى" de="Gleiche Nummer, andere Kategorie">
          <Choice
            name="otherCategory"
            value={draft.otherCategory}
            onChange={(v) => set('otherCategory', v)}
            options={[
              { value: 'hint', ar: 'تنبيه', de: 'Hinweis' },
              { value: 'off', ar: 'إيقاف', de: 'Aus' },
            ]}
          />
        </Rule>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button type="button" className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => setDraft(DEFAULT_RULES)}>
            <Bi ar="الإعدادات الافتراضية" de="Standard wiederherstellen" />
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              <Bi ar="إلغاء" de="Abbrechen" />
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={saving}>
              <Bi ar="حفظ" de="Speichern" />
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
