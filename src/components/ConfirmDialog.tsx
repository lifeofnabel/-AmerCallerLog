import { useState, type ReactNode } from 'react';
import { Button, Dialog } from './ui';

export interface ConfirmRequest {
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={request !== null} onClose={onClose} title={request?.title} width="max-w-md">
      <div className="space-y-4 text-[13px] text-muted">
        <div>{request?.body}</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} autoFocus>
            Abbrechen
          </Button>
          <Button
            variant={request?.danger ? 'danger' : 'primary'}
            disabled={busy}
            onClick={() => {
              if (request === null) return;
              setBusy(true);
              void Promise.resolve(request.onConfirm())
                .then(onClose)
                .catch(() => undefined)
                .finally(() => setBusy(false));
            }}
          >
            {request?.confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
