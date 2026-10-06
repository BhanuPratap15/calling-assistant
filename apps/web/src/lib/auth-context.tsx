'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from './api';
import type { AuthUser } from './types';

/**
 * Context = poore app me shared data (yahan: logged-in user).
 * Kisi bhi component me:  const { user, logout } = useAuth();
 */
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; // pehli baar /auth/me check ho raha hai
  sessionError: string | null; // session check hi fail hua (e.g. backend band) — 401 nahi
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // e.g. availability server ne badli (ON_CALL)
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  // /login pe session check ki zaroorat nahi (proxy ne confirm kiya ki cookie nahi hai)
  const [loading, setLoading] = useState(pathname !== '/login');
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Page load pe: cookie valid hai? → backend se user lao
  useEffect(() => {
    if (pathname === '/login') return;
    api<AuthUser>('/auth/me')
      .then(setUser)
      .catch(async (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          // Cookie hai par expire/invalid → saaf karo, warna proxy ↔ login ka loop banega
          await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        } else {
          // Backend band / server error → login pe mat bhejo, saaf message dikhao (AppShell)
          setSessionError(
            error instanceof Error
              ? error.message
              : 'Could not load your session',
          );
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
    // Sirf pehli baar (app load pe) chalana hai — har page change pe nahi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    // login response me availability nahi — /auth/me se poora user (login ne AVAILABLE kiya hoga)
    const fresh = await api<AuthUser>('/auth/me').catch(() => result.user);
    setUser(fresh);
    return fresh;
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await api<AuthUser>('/auth/me').catch(() => null);
    if (fresh) setUser(fresh);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, sessionError, login, logout, refreshUser }),
    [user, loading, sessionError, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
