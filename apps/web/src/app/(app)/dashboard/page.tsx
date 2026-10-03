'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { canSee, NAV_ITEMS } from '@/lib/navigation';
import { ROLE_LABELS } from '@/lib/types';

const DESCRIPTIONS: Record<string, string> = {
  '/calling': 'Agla customer lo, call karo, form bharo — Save & Next',
  '/follow-ups': 'Aaj ke due aur overdue follow-ups',
  '/customers': 'Customers ki list, search, add aur edit',
  '/teams': 'Teams aur unke members',
  '/staff': 'Assistants aur Team Leaders manage karo',
  '/audit-logs': 'Kisne kya kab kiya — poori history',
};

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const shortcuts = NAV_ITEMS.filter(
    (item) => item.href !== '/dashboard' && canSee(item, user.role),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Namaste, {user.name} 👋
      </h1>
      <p className="mt-1 text-slate-500">
        Aap {ROLE_LABELS[user.role]} ke roop me logged in hain.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm"
          >
            <p className="font-medium text-slate-900">{item.label}</p>
            <p className="mt-1 text-sm text-slate-500">
              {DESCRIPTIONS[item.href]}
            </p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-sm text-slate-400">
        Live numbers (calls, follow-ups, categories) Phase 8 me yahan aayenge.
      </p>
    </div>
  );
}
