import { useState } from 'react';

import type { ConfirmRequest } from '@/components/ConfirmDialog';
import type { RowActions } from '@/components/ApplicationList';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth';
import {
  cancelApplication,
  deleteApplication,
  restoreApplication,
  setStatus,
  updateApplication,
} from '@/services/applications';
import type { Application, ApplicationInput, Status } from '@/types/application';

/**
 * Alle Aktionen einer Zeile an einem Ort. Schreibvorgänge landen sofort im lokalen Stand
 * (Firestore-Zwischenspeicher) und werden – auch nach kurzem Offline-Sein – zum Server gebracht.
 * Scheitert ein Schreibvorgang endgültig (z. B. keine Berechtigung), gibt es eine Fehlermeldung.
 */
export function useRowActions(): {
  actions: RowActions;
  editing: Application | null;
  closeEdit: () => void;
  saveEdit: (app: Application, input: ApplicationInput & { receivedAt: Date }, status: Status) => Promise<void>;
  confirm: ConfirmRequest | null;
  closeConfirm: () => void;
} {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState<Application | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const fail = (what: string) => () => toast(`${what} fehlgeschlagen. Bitte erneut versuchen.`, 'error');

  const restore = (app: Application) => {
    if (user === null) return;
    restoreApplication(app, user).catch(fail('Wiederherstellen'));
    toast(
      <span>
        <b className="num">#{app.sequenceNumber}</b> wiederhergestellt · <span className="ar">تمت الاستعادة</span>
      </span>,
    );
  };

  const actions: RowActions = {
    onToggle: (app) => {
      if (user === null || app.status === 'cancelled') return;
      setStatus(app, app.status === 'completed' ? 'open' : 'completed', user).catch(fail('Statuswechsel'));
    },
    onEdit: setEditing,
    onCancel: (app) => {
      if (user === null) return;
      cancelApplication(app, user).catch(fail('Stornieren'));
      toast(
        <span className="inline-flex items-center gap-3">
          <span>
            <b className="num">#{app.sequenceNumber}</b> storniert → Papierkorb
          </span>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 font-semibold text-accent hover:bg-hover"
            onClick={() => restoreApplication({ ...app, previousStatus: app.status === 'cancelled' ? 'open' : app.status }, user).catch(fail('Rückgängig'))}
          >
            Rückgängig
          </button>
        </span>,
        'info',
      );
    },
    onRestore: restore,
    onDelete: (app) =>
      setConfirm({
        title: (
          <span>
            <span className="num text-accent">#{app.sequenceNumber}</span> endgültig löschen?
          </span>
        ),
        body: (
          <>
            <p>
              <b dir="auto" className="auto-dir text-fg">{app.name}</b> · <span className="num">{app.phone}</span>
            </p>
            <p className="mt-2">
              Der Antrag wird unwiderruflich gelöscht. Die Nummer <b className="num text-fg">#{app.sequenceNumber}</b> wird trotzdem nie
              neu vergeben. <span className="ar">لا يمكن التراجع عن الحذف.</span>
            </p>
          </>
        ),
        confirmLabel: 'Endgültig löschen',
        danger: true,
        onConfirm: async () => {
          try {
            await deleteApplication(app);
            toast(<span><b className="num">#{app.sequenceNumber}</b> endgültig gelöscht</span>, 'info');
          } catch (err) {
            fail('Löschen')();
            throw err;
          }
        },
      }),
  };

  return {
    actions,
    editing,
    closeEdit: () => setEditing(null),
    saveEdit: async (app, input, status) => {
      if (user === null) return;
      // Nicht auf den Server warten: der lokale Stand zeigt die Änderung sofort, auch offline.
      // Stornieren über den Dialog geht denselben Weg wie der Papierkorb-Knopf (vorherigen Status merken).
      if (status === 'cancelled' && app.status !== 'cancelled') {
        updateApplication(app, input, app.status, user).catch(fail('Speichern'));
        cancelApplication(app, user).catch(fail('Stornieren'));
      } else {
        updateApplication(app, input, status, user).catch(fail('Speichern'));
      }
      toast(<span><b className="num">#{app.sequenceNumber}</b> aktualisiert · <span className="ar">تم التحديث</span></span>);
    },
    confirm,
    closeConfirm: () => setConfirm(null),
  };
}
