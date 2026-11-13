'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Icon, type IconName } from '@/components/ui/icons';
import { api, ApiError } from '@/lib/api';
import type { PlatformUser } from '@/lib/platform';

const PlatformUserContext = createContext<PlatformUser | null>(null);
export const usePlatformUser = () => useContext(PlatformUserContext);

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/platform', label: 'Clients', icon: 'building' },
  { href: '/platform/organizations/new', label: 'New client', icon: 'plus' },
  { href: '/platform/team', label: 'Platform team', icon: 'shield' },
  { href: '/platform/activity', label: 'Activity', icon: 'scroll' },
  { href: '/platform/account', label: 'My account', icon: 'idCard' },
];

/**
 * Platform panel (aap) ka layout — client (staff) app se bilkul alag login + menu.
 * /platform/login pe shell nahi.
 */
export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/platform/login';
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    api<PlatformUser>('/platform/auth/me')
      .then(setUser)
      .catch(async (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          await api('/platform/auth/logout', { method: 'POST' }).catch(
            () => undefined,
          );
          router.replace('/platform/login');
        } else setError(e instanceof Error ? e.message : 'Could not load');
      });
  }, [isLogin, router]);

  const logout = useCallback(async () => {
    await api('/platform/auth/logout', { method: 'POST' }).catch(
      () => undefined,
    );
    router.replace('/platform/login');
  }, [router]);

  if (isLogin) return <>{children}</>;

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-pop">
          <h1 className="text-lg font-semibold">Cannot reach the server</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );

  const active = (href: string) =>
    href === '/platform'
      ? pathname === '/platform' ||
        (pathname.startsWith('/platform/organizations/') &&
          pathname !== '/platform/organizations/new')
      : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#0b1020_0%,#111735_100%)]">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-white ring-1 ring-white/15">
          <Icon name="building" className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-white">Platform</p>
          <p className="text-xs text-white/50">White-label console</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {NAV.map((item) => {
          const on = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                on
                  ? 'bg-white/10 font-medium text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon
                name={item.icon}
                className={`h-[18px] w-[18px] ${on ? 'text-indigo-300' : 'text-white/40'}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/5 p-4">
        <p className="truncate text-sm font-medium text-white">{user.name}</p>
        <p className="truncate text-xs text-white/50">{user.email}</p>
        <button
          onClick={logout}
          className="mt-3 flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
        >
          <Icon name="logout" className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <PlatformUserContext.Provider value={user}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block">
          {sidebar}
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-950/50"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <span className="font-semibold">Platform</span>
          </header>
          <main className="animate-fade-up mx-auto w-full max-w-[1300px] flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </PlatformUserContext.Provider>
  );
}
