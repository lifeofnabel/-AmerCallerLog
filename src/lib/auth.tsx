import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { getFirebase } from './firebase';
import type { Person } from '@/types/application';

/**
 * Anmeldung wie in Easy Consulting: dieselben Konten, dieselbe Adresse – wer dort angemeldet ist,
 * ist es hier auch. Zugang hat jedes aktive Mitarbeiterprofil (users/{uid}), die Rolle spielt keine Rolle.
 */
type AuthStatus = 'loading' | 'signed-out' | 'no-access' | 'signed-in' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: Person | null;
  email: string;
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  sendSignInLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LINK_EMAIL_KEY = 'callerlog:link-email';
/** Kommt der Link von der Anmeldeseite von Easy Consulting, steht die Adresse dort. */
const EC_LINK_EMAIL_KEY = 'easy-consulting:link-email';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<Person | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Rückkehr aus der E-Mail mit Anmeldelink.
  useEffect(() => {
    const { auth } = getFirebase();
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const address = readStorage(LINK_EMAIL_KEY) ?? readStorage(EC_LINK_EMAIL_KEY) ?? window.prompt('Zur Bestätigung bitte die E-Mail-Adresse eingeben:');
    if (address === null || address.trim() === '') return;
    void signInWithEmailLink(auth, address.trim(), window.location.href)
      .catch(() => setError('Der Anmeldelink ist abgelaufen oder wurde schon benutzt. Bitte neu anfordern.'))
      .finally(() => {
        try {
          window.localStorage.removeItem(LINK_EMAIL_KEY);
          window.localStorage.removeItem(EC_LINK_EMAIL_KEY);
        } catch {
          /* egal */
        }
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, []);

  useEffect(() => {
    const { auth, db } = getFirebase();
    return onAuthStateChanged(auth, async (account) => {
      if (account === null) {
        setUser(null);
        setEmail('');
        setStatus('signed-out');
        return;
      }
      setEmail(account.email ?? '');
      try {
        const profile = await getDoc(doc(db, 'users', account.uid));
        if (profile.exists() && profile.get('active') === true) {
          const name = String(profile.get('displayName') ?? '') || account.email || 'Mitarbeiter';
          setUser({ uid: account.uid, name });
          setError(null);
          setStatus('signed-in');
        } else {
          setUser(null);
          setStatus('no-access');
        }
      } catch (err) {
        // Offline beim Start und nichts im Zwischenspeicher, oder Regeln lehnen ab.
        const code = (err as { code?: string }).code ?? '';
        if (code === 'permission-denied') {
          setUser(null);
          setStatus('no-access');
        } else {
          setError('Profil konnte nicht geladen werden. Bitte Internetverbindung prüfen.');
          setStatus('error');
        }
      }
    });
  }, [attempt]);

  const signIn = useCallback(async (address: string, password: string) => {
    await signInWithEmailAndPassword(getFirebase().auth, address.trim(), password);
  }, []);

  const sendSignInLink = useCallback(async (address: string) => {
    const clean = address.trim();
    await sendSignInLinkToEmail(getFirebase().auth, clean, {
      url: `${window.location.origin}${import.meta.env.BASE_URL}`,
      handleCodeInApp: true,
    });
    try {
      window.localStorage.setItem(LINK_EMAIL_KEY, clean);
    } catch {
      /* dann fragt die Rückkehr nach der Adresse */
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getFirebase().auth);
  }, []);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ status, user, email, error, signIn, sendSignInLink, signOut, retry }),
    [status, user, email, error, signIn, sendSignInLink, signOut, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) throw new Error('useAuth außerhalb von AuthProvider');
  return ctx;
}

/** Firebase-Fehlercodes in verständliche Sätze. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'E-Mail oder Passwort stimmt nicht.';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche. Bitte kurz warten.';
    case 'auth/network-request-failed':
      return 'Keine Verbindung. Bitte Internet prüfen.';
    default:
      return 'Anmeldung fehlgeschlagen.';
  }
}
