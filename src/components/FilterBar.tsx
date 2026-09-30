import { Bi, IconSearch, TextInput, cx } from './ui';
import { CATEGORIES, CATEGORY_LABELS } from '@/types/application';
import type { DateScope } from '@/hooks/useApplications';
import type { Filters } from '@/utils/filter';

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode }>;
  onChange: (v: T) => void;
  label: string;
}): JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-7 rounded-[5px] px-2.5 text-[13px] whitespace-nowrap transition-colors',
            value === o.value ? 'bg-raised text-fg ring-1 ring-line-strong' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  scope,
  onScope,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  scope: DateScope;
  onScope: (s: DateScope) => void;
}): JSX.Element {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint">
          <IconSearch />
        </span>
        <TextInput
          type="search"
          dir="auto"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Suchen · بحث  (Name, Telefon, Details, #)"
          className="h-8 pl-8 text-[13px]"
          aria-label="Suchen"
        />
      </div>
      <Segmented
        label="Filter Datum"
        value={scope}
        onChange={onScope}
        options={[
          { value: 'today', label: <Bi de="Heute" ar="اليوم" /> },
          { value: 'all', label: <Bi de="Alle" ar="الكل" /> },
        ]}
      />
      <Segmented
        label="Filter Kategorie"
        value={filters.category}
        onChange={(v) => set('category', v)}
        options={[
          { value: 'all', label: 'Alle' },
          ...CATEGORIES.map((c) => ({ value: c, label: <span className="ar">{CATEGORY_LABELS[c].ar}</span> })),
        ]}
      />
      <select
        aria-label="Status"
        value={filters.status}
        onChange={(e) => set('status', e.target.value as Filters['status'])}
        className="h-8 rounded-md border border-line bg-bg px-2 text-[13px] text-fg hover:border-line-strong focus:border-accent focus:outline-none"
      >
        <option value="active">Status: Alle</option>
        <option value="open">Offen · مفتوح</option>
        <option value="completed">Erledigt · مكتمل</option>
        <option value="cancelled">Storniert · ملغى</option>
      </select>
      <button
        type="button"
        onClick={() => set('sort', filters.sort === 'desc' ? 'asc' : 'desc')}
        className="h-8 rounded-md px-2.5 text-[13px] text-muted hover:bg-hover hover:text-fg"
        title="Sortierung umschalten"
      >
        {filters.sort === 'desc' ? 'Neueste zuerst ↓' : 'Älteste zuerst ↑'}
      </button>
    </div>
  );
}
