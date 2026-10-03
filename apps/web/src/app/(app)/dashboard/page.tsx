'use client';

import Link from 'next/link';
import { CategoryBadge } from '@/components/categories/category-badge';
import { FollowUpSummaryCards } from '@/components/follow-ups/follow-up-summary-cards';
import { useAuth } from '@/lib/auth-context';
import { canSee, NAV_ITEMS } from '@/lib/navigation';
import { isManager } from '@/lib/permissions';
import {
  ROLE_LABELS,
  type CategorySummary,
  type FollowUpSummary,
} from '@/lib/types';
import { useApi } from '@/lib/use-api';

const DESCRIPTIONS: Record<string, string> = {
  '/calling': 'Agla customer lo, call karo, form bharo — Save & Next',
  '/follow-ups': 'Aaj ke due aur overdue follow-ups',
  '/customers': 'Customers ki list, search, add aur edit',
  '/assignments': 'Kaunsa customer kiske paas — assign, reassign, cancel',
  '/teams': 'Teams aur unke members',
  '/staff': 'Assistants aur Team Leaders manage karo',
  '/audit-logs': 'Kisne kya kab kiya — poori history',
  '/settings':
    'Call outcomes, categories, tags, mandatory fields, follow-up timing',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const followUps = useApi<FollowUpSummary>('/follow-ups/summary');
  const canSeeCategories = user
    ? isManager(user.role) || user.role === 'TEAM_LEADER'
    : false;
  const categories = useApi<CategorySummary>(
    canSeeCategories ? '/categories/summary' : null,
  );
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

      {followUps.data && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Follow-ups{' '}
            {user.role === 'ASSISTANT'
              ? '(mere)'
              : user.role === 'TEAM_LEADER'
                ? '(team)'
                : ''}
          </h2>
          <FollowUpSummaryCards summary={followUps.data} />
        </div>
      )}

      {categories.data && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Customers by interest
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {categories.data.categories.map((c) => (
              <Link
                key={c.id}
                href={`/customers?categoryId=${c.id}`}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300"
              >
                <CategoryBadge category={c} />
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {c.count}
                </p>
              </Link>
            ))}
            <Link
              href="/customers?categoryId=none"
              className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300"
            >
              <span className="text-xs text-slate-500">Not rated yet</span>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {categories.data.uncategorized}
              </p>
            </Link>
          </div>
        </div>
      )}

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
        Calls, categories aur team performance ke live numbers Phase 8 me yahan
        aayenge.
      </p>
    </div>
  );
}
