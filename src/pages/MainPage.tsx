import { useEffect, useMemo, useState } from 'react';

import { ApplicationList } from '@/components/ApplicationList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditDialog } from '@/components/EditDialog';
import { EntryForm } from '@/components/EntryForm';
import { FilterBar } from '@/components/FilterBar';
import { Button } from '@/components/ui';
import { useLiveApplications, useToday, type DateScope, type Source } from '@/hooks/useApplications';
import { useRowActions } from '@/hooks/useRowActions';
import { findByPhonePrefix } from '@/services/applications';
import type { Application } from '@/types/application';
import { formatDate } from '@/utils/dates';
import { applyFilters, type Filters } from '@/utils/filter';
import { phoneKey } from '@/utils/phone';

const PAGE = 300;

export function MainPage({ onVisibleChange }: { onVisibleChange: (apps: Application[], label: string) => void }): JSX.Element {
  const today = useToday();
  const [scope, setScope] = useState<DateScope>('today');
  const [count, setCount] = useState(PAGE);
  const [filters, setFilters] = useState<Filters>({ search: '', category: 'all', status: 'active', sort: 'desc' });
  const [highlight, setHighlight] = useState<number | null>(null);
  const row = useRowActions();

  const source: Source = useMemo(() => {
    if (scope === 'today') return { kind: 'day', day: today };
    if (filters.status === 'cancelled') return { kind: 'trash' };
    return { kind: 'latest', count };
  }, [scope, today, filters.status, count]);
  const live = useLiveApplications(source);

  // In „Alle“ zusätzlich serverseitig nach Telefonnummer suchen – auch jenseits der geladenen Anträge.
  const [phoneHits, setPhoneHits] = useState<Application[]>([]);
  const digits = phoneKey(filters.search);
  useEffect(() => {
    setPhoneHits([]);
    if (scope !== 'all' || digits.length < 4) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      findByPhonePrefix(digits)
        .then((hits) => !cancelled && setPhoneHits(hits))
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [scope, digits]);

  const visible = useMemo(() => {
    const byId = new Map(live.apps.map((a) => [a.id, a]));
    for (const hit of phoneHits) if (!byId.has(hit.id)) byId.set(hit.id, hit);
    return applyFilters([...byId.values()], filters);
  }, [live.apps, phoneHits, filters]);

  const label = scope === 'today' ? `Heute, ${formatDate(new Date())}` : 'Alle Anträge';
  useEffect(() => onVisibleChange(visible, label), [visible, label, onVisibleChange]);

  useEffect(() => {
    if (highlight === null) return;
    const t = window.setTimeout(() => setHighlight(null), 4000);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const openCount = visible.filter((a) => a.status === 'open').length;
  const canLoadMore = source.kind === 'latest' && live.apps.length >= count;

  return (
    <div className="space-y-4">
      <EntryForm onSaved={setHighlight} />

      <section className="print-plain rounded-lg border border-line bg-surface" aria-label="Anträge">
        <div className="no-print space-y-2.5 border-b border-line px-4 py-3">
          <h2 className="flex items-baseline gap-3 text-[15px] font-semibold">
            <span>{scope === 'today' ? 'Heutige Anträge' : 'Alle Anträge'}</span>
            <span className="ar text-sm font-normal text-muted">{scope === 'today' ? 'طلبات اليوم' : 'كل الطلبات'}</span>
            <span className="num text-[13px] font-normal text-faint">
              {visible.length} · {openCount} offen
            </span>
          </h2>
          <FilterBar filters={filters} onChange={setFilters} scope={scope} onScope={setScope} />
        </div>

        <div className="print-only px-0 pb-2">
          <h1 style={{ fontSize: '14pt', fontWeight: 700 }}>
            Anträge · <span className="ar">الطلبات</span> — {label} · {visible.length}
          </h1>
        </div>

        {live.error !== null ? (
          <p role="alert" className="px-4 py-8 text-center text-[13px] text-danger">{live.error}</p>
        ) : live.loading && live.apps.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">Lädt …</p>
        ) : (
          <ApplicationList
            apps={visible}
            actions={row.actions}
            highlight={highlight}
            empty={
              filters.search !== '' || filters.category !== 'all' || filters.status !== 'active'
                ? 'Keine Treffer für diese Filter.'
                : scope === 'today'
                  ? 'Heute noch keine Anträge · لا توجد طلبات اليوم'
                  : 'Noch keine Anträge.'
            }
          />
        )}

        {canLoadMore && (
          <div className="no-print border-t border-line px-4 py-2.5 text-center">
            <Button size="sm" variant="ghost" onClick={() => setCount((c) => c + PAGE)}>
              Ältere laden ({count} geladen)
            </Button>
          </div>
        )}
      </section>

      <EditDialog app={row.editing} onClose={row.closeEdit} onSave={row.saveEdit} />
      <ConfirmDialog request={row.confirm} onClose={row.closeConfirm} />
    </div>
  );
}
