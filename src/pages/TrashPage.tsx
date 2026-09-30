import { useEffect, useMemo, useState } from 'react';

import { ApplicationList } from '@/components/ApplicationList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Bi, IconSearch, TextInput } from '@/components/ui';
import { useLiveApplications } from '@/hooks/useApplications';
import { useRowActions } from '@/hooks/useRowActions';
import type { Application } from '@/types/application';
import { matchesSearch } from '@/utils/filter';

const SOURCE = { kind: 'trash' } as const;

export function TrashPage({ onVisibleChange }: { onVisibleChange: (apps: Application[], label: string) => void }): JSX.Element {
  const live = useLiveApplications(SOURCE);
  const row = useRowActions();
  const [search, setSearch] = useState('');
  const visible = useMemo(
    () => live.apps.filter((a) => matchesSearch(a, search)).sort((a, b) => b.sequenceNumber - a.sequenceNumber),
    [live.apps, search],
  );
  useEffect(() => onVisibleChange(visible, 'Papierkorb'), [visible, onVisibleChange]);

  return (
    <section className="print-plain rounded-lg border border-line bg-surface" aria-label="Papierkorb">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-semibold">
            <Bi de="Papierkorb" ar="سلة المحذوفات" /> <span className="num ml-2 text-[13px] font-normal text-faint">{visible.length}</span>
          </h2>
          <p className="mt-0.5 text-xs text-faint">
            Stornierte Anträge. Wiederherstellen behält die ursprüngliche Nummer. Löschen ist endgültig.
          </p>
        </div>
        <div className="no-print relative w-full sm:w-72">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint">
            <IconSearch />
          </span>
          <TextInput
            type="search"
            dir="auto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen · بحث"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>
      <div className="print-only pb-2">
        <h1 style={{ fontSize: '14pt', fontWeight: 700 }}>Papierkorb · سلة المحذوفات</h1>
      </div>
      {live.error !== null ? (
        <p role="alert" className="px-4 py-8 text-center text-[13px] text-danger">{live.error}</p>
      ) : live.loading && live.apps.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-faint">Lädt …</p>
      ) : (
        <ApplicationList apps={visible} actions={row.actions} empty="Der Papierkorb ist leer · السلة فارغة" />
      )}
      <ConfirmDialog request={row.confirm} onClose={row.closeConfirm} />
    </section>
  );
}
