import { cx } from './ui';

/** Offen ↔ Erledigt als schlichter Schalter. */
export function StatusSwitch({
  completed,
  onToggle,
  disabled,
}: {
  completed: boolean;
  onToggle: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={completed}
      disabled={disabled}
      onClick={onToggle}
      title={completed ? 'Erledigt – klicken für Offen' : 'Offen – klicken für Erledigt'}
      className="group inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-hover disabled:opacity-50"
    >
      <span
        className={cx(
          'relative inline-block h-[18px] w-8 rounded-full border transition-colors',
          completed ? 'border-ok/50 bg-ok/25' : 'border-line-strong bg-bg',
        )}
      >
        <span
          className={cx(
            'absolute top-[2px] h-3 w-3 rounded-full transition-all',
            completed ? 'left-[15px] bg-ok' : 'left-[2px] bg-faint group-hover:bg-muted',
          )}
        />
      </span>
      <span className={cx('w-14 text-left', completed ? 'text-ok' : 'text-muted')}>
        {completed ? 'Erledigt' : 'Offen'}
      </span>
    </button>
  );
}
