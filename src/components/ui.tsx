import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Deutsch + Arabisch nebeneinander: „Name · الاسم“. */
export function Bi({ de, ar, className }: { de: string; ar: string; className?: string }): JSX.Element {
  return (
    <span className={cx('inline-flex items-baseline gap-1.5', className)}>
      <span>{de}</span>
      <span className="ar text-[0.95em] opacity-70">{ar}</span>
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn';
type Size = 'sm' | 'md' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-strong text-black hover:bg-accent font-semibold',
  secondary: 'bg-raised text-fg border border-line hover:bg-hover hover:border-line-strong',
  ghost: 'text-muted hover:text-fg hover:bg-hover',
  danger: 'bg-danger/90 text-white hover:bg-danger font-semibold',
  warn: 'bg-warn text-black hover:brightness-110 font-semibold',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});

export const inputClass =
  'h-10 w-full rounded-md border border-line bg-bg px-3 text-sm text-fg placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent focus:outline-none';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export function FieldLabel({
  htmlFor,
  de,
  ar,
  hint,
}: {
  htmlFor?: string;
  de: string;
  ar: string;
  hint?: string;
}): JSX.Element {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-muted">
      <Bi de={de} ar={ar} />
      {hint !== undefined && <span className="font-normal text-faint">{hint}</span>}
    </label>
  );
}

/** Modaler Dialog auf Basis von <dialog> – Esc schließt, Fokus bleibt drin. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  width?: string;
}): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cx(
        'no-print m-auto w-[calc(100%-2rem)] rounded-lg border border-line-strong bg-surface p-0 text-fg shadow-2xl',
        width,
      )}
    >
      {open && (
        <div>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded p-1 text-faint hover:text-fg" aria-label="Schließen">
              <IconX />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

// Wenige, schlichte Symbole – nur wo sie Platz sparen.
const svg = 'h-4 w-4 shrink-0';
export const IconX = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const IconCopy = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
);
export const IconEdit = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
export const IconTrash = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
);
export const IconRestore = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
);
export const IconSearch = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconMenu = () => (
  <svg className={svg} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
);
