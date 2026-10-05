'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AvailabilitySelect } from '@/components/layout/availability-select';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { NotificationBell } from '@/components/layout/notification-bell';
import { useAuth } from '@/lib/auth-context';
import { canSee, findNavItem, NAV_ITEMS } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/types';

/**
 * Login ke baad ka layout: left sidebar (role ke hisaab se menu) + top header + page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, sessionError, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Session nahi mila → login pe bhejo (lekin backend hi band ho to nahi — neeche message)
  useEffect(() => {
    if (!loading && !user && !sessionError) router.replace('/login');
  }, [loading, user, sessionError, router]);

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Server se connection nahi
          </h1>
          <p className="mt-2 text-sm text-slate-600">{sessionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  // Manager ne password set / reset kiya → pehle khud ka password (baaki app band — backend bhi 403 deta hai)
  if (user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            Naya password set karein
          </h1>
          <p className="mt-1 mb-4 text-sm text-slate-600">
            Namaste {user.name}! Aapka password manager ne set kiya hai —
            security ke liye pehle apna khud ka password banaiye.
          </p>
          <ChangePasswordForm />
          <button
            onClick={logout}
            className="mt-4 text-sm text-slate-500 hover:underline"
          >
            Logout
          </button>
        </div>
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
          {(user.role === 'ASSISTANT' || user.role === 'TEAM_LEADER') &&
            user.availability && (
              <AvailabilitySelect
                key={user.availability}
                initial={user.availability}
              />
            )}
          <NotificationBell />
          <Link
            href="/account"
            className="text-right hover:opacity-80"
            title="My account"
          >
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </Link>
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
