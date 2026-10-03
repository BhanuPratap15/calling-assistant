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
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  // /login pe session check ki zaroorat nahi (proxy ne confirm kiya ki cookie nahi hai)
  const [loading, setLoading] = useState(pathname !== '/login');

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
          console.error('Failed to load session', error);
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
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
