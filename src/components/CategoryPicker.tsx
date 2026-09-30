import { forwardRef, useRef, type KeyboardEvent } from 'react';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/types/application';
import { cx } from './ui';

interface Props {
  value: Category | null;
  onChange: (value: Category) => void;
  /** Nach der Auswahl per Tastatur weiter zum nächsten Feld. */
  onPicked?: () => void;
  size?: 'md' | 'lg';
}

/**
 * Kategorie als Segmentauswahl. Tastatur: 1/2/3 wählt direkt und springt weiter,
 * Pfeiltasten wechseln, Enter/Leertaste bestätigt.
 */
export const CategoryPicker = forwardRef<HTMLDivElement, Props>(function CategoryPicker(
  { value, onChange, onPicked, size = 'lg' },
  ref,
) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const current = value === null ? -1 : CATEGORIES.indexOf(value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const digit = Number(e.key);
    if (digit >= 1 && digit <= CATEGORIES.length) {
      e.preventDefault();
      onChange(CATEGORIES[digit - 1]!);
      onPicked?.();
      return;
    }
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (Math.max(current, 0) + step + CATEGORIES.length) % CATEGORIES.length;
      onChange(CATEGORIES[nextIndex]!);
      buttons.current[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Kategorie"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="grid grid-cols-3 gap-1 rounded-md border border-line bg-bg p-[3px] focus:outline-none"
    >
      {CATEGORIES.map((category, i) => {
        const active = value === category;
        const label = CATEGORY_LABELS[category];
        return (
          <button
            key={category}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (current === -1 && i === 0) ? 0 : -1}
            onClick={() => {
              onChange(category);
              onPicked?.();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onChange(category);
                onPicked?.();
              }
            }}
            className={cx(
              'flex items-center justify-center gap-2 rounded-[5px] px-3 whitespace-nowrap transition-colors',
              size === 'lg' ? 'h-[32px] text-[15px]' : 'h-8 text-sm',
              active ? 'bg-accent-soft text-accent ring-1 ring-accent/40 ring-inset' : 'text-muted hover:bg-hover hover:text-fg',
            )}
          >
            <span className="ar font-semibold">{label.ar}</span>
            <span className="text-xs opacity-60">{label.de}</span>
          </button>
        );
      })}
    </div>
  );
});
