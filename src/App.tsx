import { useCallback, useRef, useState } from 'react';

import { RestoreDialog } from '@/components/RestoreDialog';
import { useToast } from '@/components/Toast';
import { Bi, Button, IconMenu, cx } from '@/components/ui';
import { useOnline } from '@/hooks/useApplications';
import { useBackupReminder } from '@/hooks/useBackupReminder';
import { useAuth } from '@/lib/auth';
import { firebaseConfigured } from '@/lib/firebase';
import { LoginPage, Logo } from '@/pages/LoginPage';
import { MainPage } from '@/pages/MainPage';
import { TrashPage } from '@/pages/TrashPage';
import { downloadBackup } from '@/services/backup';
import { downloadCsv } from '@/services/csv';
import type { Application } from '@/types/application';

export default function App(): JSX.Element {
  const { status, email, error, signOut, retry } = useAuth();

  if (!firebaseConfigured) {
    return (
      <Centered>
        <p className="font-semibold">Firebase ist nicht konfiguriert.</p>
        <p className="mt-1 text-muted">.env mit den VITE_FIREBASE_*-Werten anlegen (siehe .env.example).</p>
      </Centered>
    );
  }
  if (status === 'loading') return <Centered><span className="text-faint">Lädt …</span></Centered>;
  if (status === 'signed-out') return <LoginPage />;
  if (status === 'error') {
    return (
      <Centered>
        <p>{error}</p>
        <Button className="mt-3" onClick={retry}>Erneut versuchen</Button>
      </Centered>
    );
  }
  if (status === 'no-access') {
    return (
      <Centered>
        <p className="font-semibold">Kein Zugang · لا يوجد صلاحية</p>
        <p className="mt-1 text-muted">
          {email} hat kein aktives Mitarbeiterprofil in Easy Consulting. Bitte im Bereich „Mitarbeiter“ einladen lassen und sich
          einmal in Easy Consulting anmelden.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={retry}>Erneut prüfen</Button>
          <Button variant="ghost" onClick={() => void signOut()}>Abmelden</Button>
        </div>
      </Centered>
    );
  }
  return <Workspace />;
}

function Centered({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-lg border border-line bg-surface px-6 py-5 text-center text-sm">{children}</div>
    </div>
  );
}

type View = 'main' | 'trash';

function Workspace(): JSX.Element {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const online = useOnline();
  const reminder = useBackupReminder();
  const [view, setView] = useState<View>('main');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const visible = useRef<{ apps: Application[]; label: string }>({ apps: [], label: '' });
  const onVisibleChange = useCallback((apps: Application[], label: string) => {
    visible.current = { apps, label };
  }, []);

  const backup = async () => {
    if (user === null) return;
    setBackingUp(true);
    try {
      const b = await downloadBackup(user);
      toast(`Backup heruntergeladen: ${b.applications.length} Anträge`);
    } catch {
      toast('Backup fehlgeschlagen – bitte Internetverbindung prüfen.', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const menuItems: Array<{ label: React.ReactNode; onClick: () => void; hint?: string }> = [
    { label: <Bi de="CSV exportieren" ar="تصدير" />, hint: 'aktuelle Liste', onClick: () => downloadCsv(visible.current.apps) },
    { label: <Bi de="Drucken" ar="طباعة" />, hint: 'aktuelle Liste', onClick: () => window.print() },
    { label: <Bi de="Backup herunterladen" ar="نسخة احتياطية" />, hint: 'alles, JSON', onClick: () => void backup() },
    { label: <Bi de="Backup wiederherstellen" ar="استعادة" />, onClick: () => setRestoreOpen(true) },
  ];

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-13 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5" title="Zu Easy Consulting">
            <Logo />
          </a>
          <div className="mr-2 hidden leading-tight sm:block">
            <div className="text-sm font-semibold tracking-tight">
              Caller Log <span className="font-normal text-faint">Easy</span>
            </div>
            <div className="text-[11px] text-faint">Amer Consulting</div>
          </div>

          <nav className="flex items-center gap-1" aria-label="Bereiche">
            {(
              [
                ['main', 'Anträge', 'الطلبات'],
                ['trash', 'Papierkorb', 'السلة'],
              ] as const
            ).map(([key, de, ar]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-current={view === key ? 'page' : undefined}
                className={cx(
                  'h-8 rounded-md px-3 text-[13px] font-medium transition-colors',
                  view === key ? 'bg-raised text-fg ring-1 ring-line-strong' : 'text-muted hover:bg-hover hover:text-fg',
                )}
              >
                <Bi de={de} ar={ar} />
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <span
              className={cx('hidden items-center gap-1.5 text-xs sm:inline-flex', online ? 'text-faint' : 'text-warn')}
              title={online ? 'Verbunden – Änderungen erscheinen live auf allen Geräten' : 'Offline'}
            >
              <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-ok' : 'bg-warn')} />
              {online ? 'Live' : 'Offline'}
            </span>
            <span className="hidden max-w-[10rem] truncate text-xs text-muted md:inline">{user?.name}</span>
            <div className="relative">
              <Button size="icon" variant="ghost" aria-label="Menü" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                <IconMenu />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <div role="menu" className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-md border border-line-strong bg-surface py-1 shadow-2xl">
                    {menuItems.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          item.onClick();
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-hover"
                      >
                        {item.label}
                        {item.hint !== undefined && <span className="text-[11px] text-faint">{item.hint}</span>}
                      </button>
                    ))}
                    <div className="my-1 border-t border-line" />
                    <a href="/" role="menuitem" className="block px-3 py-2 text-[13px] text-muted hover:bg-hover hover:text-fg">
                      Zu Easy Consulting
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void signOut()}
                      className="block w-full px-3 py-2 text-left text-[13px] text-muted hover:bg-hover hover:text-fg"
                    >
                      Abmelden · {user?.name}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {!online && (
        <div className="no-print border-b border-warn/30 bg-warn-soft px-4 py-2 text-center text-[13px]">
          Offline – Statuswechsel und Änderungen werden gespeichert und automatisch übertragen. Neue Anträge brauchen eine Verbindung.
        </div>
      )}

      {reminder.visible && (
        <div className="no-print border-b border-line bg-surface">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2 text-[13px] sm:px-6">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span>
              Wöchentliches Backup empfohlen · <span className="ar text-muted">يُنصح بنسخة احتياطية أسبوعية</span>
            </span>
            <Button size="sm" variant="primary" onClick={() => void backup()} disabled={backingUp}>
              {backingUp ? 'Lädt …' : 'Backup herunterladen'}
            </Button>
            <button type="button" onClick={reminder.dismiss} className="text-xs text-faint hover:text-fg">
              Später
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-5">
        {view === 'main' ? <MainPage onVisibleChange={onVisibleChange} /> : <TrashPage onVisibleChange={onVisibleChange} />}
      </main>

      <RestoreDialog open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </div>
  );
}
