'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { canSee, findNavItem, NAV_ITEMS } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/types';

/**
 * Login ke baad ka layout: left sidebar (role ke hisaab se menu) + top header + page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Session nahi mila → login pe bhejo
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  const menu = NAV_ITEMS.filter((item) => canSee(item, user.role));
  const current = findNavItem(pathname);
  const allowed = !current || canSee(current, user.role);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-lg font-semibold text-slate-900">Calling CRM</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {menu.map((item) => {
            const active = current?.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-indigo-50 font-medium text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </header>

        <main className="flex-1 p-6">
          {allowed ? (
            children
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
              Aapke role ({ROLE_LABELS[user.role]}) ko is page ki permission
              nahi hai.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
