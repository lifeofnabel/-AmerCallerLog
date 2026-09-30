import { useEffect, useMemo, useState } from 'react';

import { ApplicationList } from '@/components/ApplicationList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditDialog } from '@/components/EditDialog';
import { EntryForm } from '@/components/EntryForm';
import { FilterBar } from '@/components/FilterBar';
import { Bi, Button } from '@/components/ui';
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
  // Gerade gespeicherte Anträge sofort zeigen – der Live-Abgleich ersetzt sie, sobald er sie liefert.
  const [justSaved, setJustSaved] = useState<Application[]>([]);
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
    for (const app of justSaved) {
      const fits = source.kind === 'day' ? app.day === source.day : source.kind === 'latest';
      if (fits && !byId.has(app.id)) byId.set(app.id, app);
    }
    return applyFilters([...byId.values()], filters);
  }, [live.apps, phoneHits, justSaved, source, filters]);

  // Sobald der Live-Abgleich einen gerade gespeicherten Antrag kennt, wird die lokale Kopie überflüssig.
  useEffect(() => {
    if (justSaved.length === 0) return;
    const known = new Set(live.apps.map((a) => a.id));
    if (justSaved.some((a) => known.has(a.id))) setJustSaved((list) => list.filter((a) => !known.has(a.id)));
  }, [live.apps, justSaved]);

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
      <EntryForm
        onSaved={(app) => {
          setJustSaved((list) => [...list, app]);
          setHighlight(app.sequenceNumber);
        }}
      />

      <section className="print-plain rounded-lg border border-line bg-surface" aria-label="Anträge">
        <div className="no-print space-y-2.5 border-b border-line px-4 py-3">
          <h2 className="flex items-baseline gap-3 text-[15px] font-semibold">
            {scope === 'today' ? <Bi ar="طلبات اليوم" de="Heutige Anträge" /> : <Bi ar="كل الطلبات" de="Alle Anträge" />}
            <span className="text-[13px] font-normal text-faint">
              <span className="num ltr">{visible.length}</span> · <span className="num ltr">{openCount}</span>{' '}
              <span className="ar">مفتوح</span>
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
              <Bi ar="تحميل الأقدم" de={`Ältere laden (${count})`} />
            </Button>
          </div>
        )}
      </section>

      <EditDialog app={row.editing} onClose={row.closeEdit} onSave={row.saveEdit} />
      <ConfirmDialog request={row.confirm} onClose={row.closeConfirm} />
    </div>
  );
}
