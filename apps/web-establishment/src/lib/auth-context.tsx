'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  getFirebaseAuth,
  getIdToken,
  isFirebaseConfigured,
} from '@/lib/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  getToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
  }, [configured]);

  const getToken = useCallback(async () => {
    if (!configured) return null;
    return getIdToken();
  }, [configured]);

  const logout = useCallback(async () => {
    if (!configured) return;
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('frego.activeBusinessId'),
      );
      for (const k of keys) localStorage.removeItem(k);
    }
    await signOut(getFirebaseAuth());
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  }, [configured]);

  const value = useMemo(
    () => ({ user, loading, configured, getToken, logout }),
    [user, loading, configured, getToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
