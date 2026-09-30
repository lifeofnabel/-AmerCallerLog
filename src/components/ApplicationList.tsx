import { useToast } from './Toast';
import { StatusSwitch } from './StatusSwitch';
import { Bi, IconCopy, IconEdit, IconRestore, IconTrash, cx } from './ui';
import { CATEGORY_LABELS, STATUS_LABELS, type Application } from '@/types/application';
import { formatDate, formatTime, todayKey } from '@/utils/dates';

export interface RowActions {
  onToggle?: (app: Application) => void;
  onEdit?: (app: Application) => void;
  onCancel?: (app: Application) => void;
  onRestore?: (app: Application) => void;
  onDelete?: (app: Application) => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback für ältere Browser / ohne Berechtigung.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function useCopyPhone(): (app: Application) => void {
  const toast = useToast();
  return (app) => {
    void copyText(app.phone).then((ok) =>
      toast(ok ? <span>Nummer kopiert · <span className="num">{app.phone}</span></span> : 'Kopieren nicht möglich', ok ? 'info' : 'error'),
    );
  };
}

function when(app: Application): string {
  return app.day === todayKey() ? formatTime(app.receivedAt) : `${formatDate(app.receivedAt)} ${formatTime(app.receivedAt)}`;
}

function CategoryTag({ app }: { app: Application }): JSX.Element {
  const label = CATEGORY_LABELS[app.category];
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="ar font-semibold text-fg">{label.ar}</span>
      <span className="text-xs text-faint">{label.de}</span>
    </span>
  );
}

function StatusCell({ app, actions }: { app: Application; actions: RowActions }): JSX.Element {
  if (app.status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 text-[13px] text-danger">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" />
        <span className="ar">{STATUS_LABELS.cancelled.ar}</span>
      </span>
    );
  }
  return (
    <>
      <span className="no-print">
        <StatusSwitch
          completed={app.status === 'completed'}
          onToggle={() => actions.onToggle?.(app)}
          disabled={actions.onToggle === undefined}
        />
      </span>
      <span className="print-only">{STATUS_LABELS[app.status].ar} · {STATUS_LABELS[app.status].de}</span>
    </>
  );
}

function ActionButtons({ app, actions }: { app: Application; actions: RowActions }): JSX.Element {
  const copy = useCopyPhone();
  const btn = 'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted hover:bg-hover hover:text-fg';
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" className={btn} onClick={() => copy(app)} title="Nummer kopieren · نسخ الرقم">
        <IconCopy />
      </button>
      {app.status !== 'cancelled' ? (
        <>
          {actions.onEdit && (
            <button type="button" className={btn} onClick={() => actions.onEdit?.(app)} title="Bearbeiten · تعديل">
              <IconEdit />
            </button>
          )}
          {actions.onCancel && (
            <button
              type="button"
              className={cx(btn, 'hover:text-danger')}
              onClick={() => actions.onCancel?.(app)}
              title="Stornieren → Papierkorb · إلغاء"
            >
              <IconTrash />
            </button>
          )}
        </>
      ) : (
        <>
          {actions.onRestore && (
            <button type="button" className={btn} onClick={() => actions.onRestore?.(app)} title="Wiederherstellen · استعادة">
              <IconRestore />
              <span className="ar hidden sm:inline">استعادة</span>
            </button>
          )}
          {actions.onDelete && (
            <button
              type="button"
              className={cx(btn, 'hover:text-danger')}
              onClick={() => actions.onDelete?.(app)}
              title="Endgültig löschen · حذف نهائي"
            >
              <IconTrash />
              <span className="ar hidden sm:inline">حذف</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Antragsliste: Tabelle am Desktop (und im Druck), kompakte Liste auf Tablet/Handy.
 */
export function ApplicationList({
  apps,
  actions,
  highlight,
  empty,
}: {
  apps: Application[];
  actions: RowActions;
  highlight?: number | null;
  empty: React.ReactNode;
}): JSX.Element {
  if (apps.length === 0) {
    return <div className="px-4 py-10 text-center text-[13px] text-faint">{empty}</div>;
  }
  return (
    <>
      <table className="print-table hidden w-full border-collapse text-start md:table">
        <thead>
          <tr className="border-b border-line text-[11px] font-semibold tracking-wide text-faint uppercase">
            <th className="w-[4.5rem] px-4 py-2 text-start font-semibold">#</th>
            <th className="px-3 py-2 font-semibold"><Bi de="Name" ar="الاسم" /></th>
            <th className="px-3 py-2 font-semibold"><Bi de="Telefon" ar="الهاتف" /></th>
            <th className="px-3 py-2 font-semibold"><Bi de="Kategorie" ar="الفئة" /></th>
            <th className="px-3 py-2 font-semibold"><Bi de="Details" ar="التفاصيل" /></th>
            <th className="px-3 py-2 font-semibold"><Bi de="Zeit" ar="الوقت" /></th>
            <th className="px-3 py-2 font-semibold"><Bi de="Status" ar="الحالة" /></th>
            <th className="no-print px-3 py-2" aria-label="Aktionen" />
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr
              key={app.id}
              data-seq={app.sequenceNumber}
              className={cx(
                'border-b border-line/70 transition-colors last:border-0 hover:bg-raised',
                highlight === app.sequenceNumber && 'bg-accent-soft',
                app.status === 'completed' && 'text-muted',
              )}
            >
              <td className="num px-4 py-2 font-semibold text-accent">
                <span className="ltr">#{app.sequenceNumber}</span>
                {app.pending && <span className="ms-1 text-[10px] font-normal text-warn" title="Noch nicht synchronisiert">●</span>}
              </td>
              <td dir="auto" className="auto-dir max-w-[16rem] truncate px-3 py-2 font-medium text-fg">{app.name}</td>
              <td className="num px-3 py-2 whitespace-nowrap"><span className="ltr">{app.phone}</span></td>
              <td className="px-3 py-2"><CategoryTag app={app} /></td>
              <td dir="auto" className="auto-dir max-w-[22rem] truncate px-3 py-2 text-muted" title={app.details}>{app.details}</td>
              <td className="num px-3 py-2 whitespace-nowrap text-muted"><span className="ltr">{when(app)}</span></td>
              <td className="px-3 py-1"><StatusCell app={app} actions={actions} /></td>
              <td className="no-print px-3 py-1"><ActionButtons app={app} actions={actions} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="no-print divide-y divide-line/70 md:hidden">
        {apps.map((app) => (
          <li key={app.id} data-seq={app.sequenceNumber} className={cx('px-3 py-2.5', highlight === app.sequenceNumber && 'bg-accent-soft')}>
            <div className="flex items-baseline gap-2">
              <span className="num ltr font-semibold text-accent">#{app.sequenceNumber}</span>
              <span dir="auto" className="auto-dir min-w-0 flex-1 truncate font-medium">{app.name}</span>
              <CategoryTag app={app} />
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[13px] text-muted">
              <span className="num ltr">{app.phone}</span>
              <span className="num ltr text-faint">{when(app)}</span>
            </div>
            {app.details !== '' && (
              <p dir="auto" className="auto-dir mt-0.5 line-clamp-2 text-[13px] text-muted">{app.details}</p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <StatusCell app={app} actions={actions} />
              <ActionButtons app={app} actions={actions} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
