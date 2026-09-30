import { useState, type FormEvent } from 'react';

import { Bi, Button, FieldLabel, TextInput } from '@/components/ui';
import { authErrorMessage, useAuth } from '@/lib/auth';

export function LoginPage(): JSX.Element {
  const { signIn, sendSignInLink, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function link() {
    setError(null);
    setInfo(null);
    if (email.trim() === '') return setError('Bitte zuerst die E-Mail-Adresse eingeben.');
    setBusy(true);
    try {
      await sendSignInLink(email);
      setInfo(`Anmeldelink an ${email.trim()} geschickt. Bitte in der E-Mail bestätigen.`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Caller Log <span className="font-normal text-faint">Easy</span>
            </h1>
            <p className="text-xs text-muted">Amer Consulting · Antragserfassung</p>
          </div>
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-3.5 rounded-lg border border-line bg-surface p-5">
          <div>
            <FieldLabel htmlFor="login-email" de="E-Mail" ar="البريد الإلكتروني" />
            <TextInput id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </div>
          <div>
            <FieldLabel htmlFor="login-password" de="Passwort" ar="كلمة المرور" />
            <TextInput id="login-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {(error ?? authError) !== null && (
            <p role="alert" className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-[13px]">{error ?? authError}</p>
          )}
          {info !== null && <p className="rounded-md border border-ok/30 bg-ok-soft px-3 py-2 text-[13px]">{info}</p>}
          <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy || password === ''}>
            <Bi de="Anmelden" ar="تسجيل الدخول" />
          </Button>
          <button type="button" onClick={() => void link()} disabled={busy} className="w-full text-center text-xs text-muted hover:text-fg">
            Ohne Passwort: Anmeldelink per E-Mail
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-faint">Gleiches Konto wie in Easy Consulting.</p>
      </div>
    </div>
  );
}

export function Logo(): JSX.Element {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-accent/40 bg-accent-soft text-[13px] font-bold tracking-tight text-accent">
      CL
    </span>
  );
}
