import { forwardRef } from 'react';

import { Button, IconAlert, IconInfo, cx } from './ui';
import type { DuplicateResult } from '@/services/duplicates';
import { CATEGORY_LABELS, STATUS_LABELS, type Application } from '@/types/application';
import { formatDate } from '@/utils/dates';

type Tone = 'danger' | 'warn' | 'info';

const TONES: Record<Tone, string> = {
  danger: 'border-danger/40 bg-danger-soft text-danger',
  warn: 'border-warn/45 bg-warn-soft text-warn',
  info: 'border-info/35 bg-info-soft text-info',
};

function Entries({ apps }: { apps: Application[] }): JSX.Element {
  const shown = apps.slice(0, 4);
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {shown.map((a) => (
        <li key={a.id} className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-fg">
          <b className="num ltr text-accent">#{a.sequenceNumber}</b>
          <span dir="auto" className="auto-dir font-semibold">{a.name}</span>
          <span className="ar text-muted">{CATEGORY_LABELS[a.category].ar}</span>
          <span className="num ltr text-faint">{formatDate(a.receivedAt)}</span>
          <span className={cx('text-xs', a.status === 'completed' ? 'text-ok' : 'text-muted')}>
            <span className="ar">{STATUS_LABELS[a.status].ar}</span>
          </span>
        </li>
      ))}
      {apps.length > shown.length && <li className="self-center text-xs text-faint">+{apps.length - shown.length}</li>}
    </ul>
  );
}

function Panel({
  tone,
  title,
  sub,
  apps,
  children,
}: {
  tone: Tone;
  title: React.ReactNode;
  sub: React.ReactNode;
  apps: Application[];
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('rounded-lg border border-s-4 px-4 py-3', TONES[tone])}>
      <div className="flex items-start gap-3">
        {tone === 'info' ? <IconInfo /> : <IconAlert />}
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{title}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            <span lang="de" dir="ltr" className="ltr">{sub}</span>
          </p>
          <Entries apps={apps} />
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Hinweise zur eingegebenen Nummer – immer mit #Nummer und Name aus dem Caller Log.
 * Rot nur bei „alles gleich“; die anderen Fälle sind ruhige Hinweise.
 */
export const DuplicateNotice = forwardRef<
  HTMLButtonElement,
  { result: DuplicateResult; confirmPending: boolean; onOverride: () => void; saving: boolean }
>(function DuplicateNotice({ result, confirmPending, onOverride, saving }, ref) {
  const first = result.exact[0];
  return (
    <div className="space-y-2">
      {first !== undefined && (
        <Panel
          tone={result.block === 'none' ? 'warn' : 'danger'}
          title={
            <>
              <span className="ar">مسجّل مسبقاً</span> · <span className="ltr">Schon erfasst als #{first.sequenceNumber}</span>
            </>
          }
          sub={
            result.block === 'hard'
              ? 'Gleiche Nummer, gleicher Name, gleiche Kategorie. Speichern ist gesperrt (Einstellungen).'
              : result.block === 'soft'
                ? 'Gleiche Nummer, gleicher Name, gleiche Kategorie. Nur speichern, wenn es wirklich ein neuer Antrag ist.'
                : 'Gleiche Nummer, gleicher Name, gleiche Kategorie.'
          }
          apps={result.exact}
        >
          {result.block === 'soft' && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button ref={ref} variant="secondary" size="sm" onClick={onOverride} disabled={saving}>
                <span className="ar">حفظ على أي حال</span>
                <span className="text-xs opacity-70">Trotzdem speichern</span>
              </Button>
              {confirmPending && (
                <span className="text-xs text-muted">
                  <span className="ar">Enter للتأكيد</span> · <span className="ltr">Enter bestätigt · Esc bricht ab</span>
                </span>
              )}
            </div>
          )}
        </Panel>
      )}
      {result.sameCategory.length > 0 && (
        <Panel
          tone="warn"
          title={
            <>
              <span className="ar">نفس الرقم في نفس الفئة</span> · <span className="ltr">Nummer schon in dieser Kategorie</span>
            </>
          }
          sub="Anderer Name – vielleicht Sohn, Tochter oder Familie. Nur ein Hinweis."
          apps={result.sameCategory}
        />
      )}
      {result.otherCategory.length > 0 && (
        <Panel
          tone="info"
          title={
            <>
              <span className="ar">الرقم مسجّل بفئة أخرى</span> · <span className="ltr">Schon gehabt, andere Kategorie</span>
            </>
          }
          sub="Bekannte Nummer. Speichern geht normal."
          apps={result.otherCategory}
        />
      )}
    </div>
  );
});
