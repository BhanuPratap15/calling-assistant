'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AvailabilitySelect } from '@/components/layout/availability-select';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { NotificationBell } from '@/components/layout/notification-bell';
import { Icon } from '@/components/ui/icons';
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Session nahi mila → login pe bhejo (lekin backend hi band ho to nahi — neeche message)
  useEffect(() => {
    if (!loading && !user && !sessionError) router.replace('/login');
  }, [loading, user, sessionError, router]);

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-pop-in max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-pop">
          <h1 className="text-lg font-semibold text-slate-900">
            Cannot reach the server
          </h1>
          <p className="mt-2 text-sm text-slate-600">{sessionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-brand hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  // Manager ne password set / reset kiya → pehle khud ka password (baaki app band — backend bhi 403 deta hai)
  if (user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="animate-pop-in w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-pop">
          <h1 className="text-lg font-semibold text-slate-900">
            Set a new password
          </h1>
          <p className="mt-1 mb-4 text-sm text-slate-600">
            Hello {user.name}! Your password was set by a manager — for
            security, please choose your own password first.
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
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,var(--sidebar-bg)_0%,var(--sidebar-bg-2)_100%)]">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-white shadow-lg shadow-indigo-900/40 ring-1 ring-white/15">
          <Icon name="phone" className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-white">
            Calling CRM
          </p>
          <p className="truncate text-xs text-[var(--sidebar-text)]">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>

      <p className="px-6 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
        Menu
      </p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {menu.map((item) => {
          const active = current?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                active
                  ? 'bg-[var(--sidebar-active)] font-medium text-[var(--sidebar-text-active)]'
                  : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-indigo-400" />
              )}
              <Icon
                name={item.icon}
                className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-indigo-300' : 'text-white/40 group-hover:text-white/70'}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] p-3">
        <Link
          href="/account"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--sidebar-hover)]"
          title="My account"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-300 to-indigo-600 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">
              {user.name}
            </span>
            <span className="block truncate text-xs text-[var(--sidebar-text)]">
              {user.email}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="animate-fade-up absolute inset-y-0 left-0 w-72 shadow-pop">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <p className="hidden truncate text-sm font-medium text-slate-500 md:block">
              {current?.label ?? 'My account'}
            </p>
          </div>

          {/* Brand — bilkul center me */}
          <Link
            href="/dashboard"
            aria-label="Addaplay — go to dashboard"
            className="group flex items-center gap-2 justify-self-center"
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            <span className="animate-brand-in bg-[linear-gradient(110deg,var(--brand-700)_0%,var(--brand-500)_30%,#d946ef_50%,var(--brand-500)_70%,var(--brand-700)_100%)] bg-[length:200%_auto] bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl">
              Addaplay
            </span>
          </Link>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            {(user.role === 'ASSISTANT' || user.role === 'TEAM_LEADER') &&
              user.availability && (
                <span className="hidden sm:block">
                  <AvailabilitySelect
                    key={user.availability}
                    initial={user.availability}
                  />
                </span>
              )}
            <NotificationBell />
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <button
              onClick={logout}
              title="Logout"
              className="group flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 text-sm font-semibold text-red-600 shadow-xs hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-md hover:shadow-red-600/25 active:scale-[0.97] sm:px-3.5"
            >
              <Icon
                name="logout"
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main
          key={pathname}
          className="animate-fade-up mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8"
        >
          {allowed ? (
            children
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
              Your role ({ROLE_LABELS[user.role]}) does not have permission to
              view this page.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
