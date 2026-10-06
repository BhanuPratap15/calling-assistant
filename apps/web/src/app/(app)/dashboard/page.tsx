'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CategoryBadge } from '@/components/categories/category-badge';
import { FollowUpSummaryCards } from '@/components/follow-ups/follow-up-summary-cards';
import { AssistantTable } from '@/components/reports/assistant-table';
import { KpiTiles } from '@/components/reports/kpi-tiles';
import { ReportCharts } from '@/components/reports/report-charts';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { useAuth } from '@/lib/auth-context';
import { canSee, NAV_ITEMS } from '@/lib/navigation';
import { isManager } from '@/lib/permissions';
import {
  DEFAULT_FILTERS,
  filterParams,
  type ReportFilters,
} from '@/lib/report';
import {
  ROLE_LABELS,
  type AssistantReportRow,
  type CategorySummary,
  type FollowUpSummary,
  type ReportSummary,
} from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

const DESCRIPTIONS: Record<string, string> = {
  '/calling': 'Get the next customer, call, fill the form — Save & Next',
  '/follow-ups': 'Follow-ups due today and overdue',
  '/customers': 'Customer list — search, add and edit',
  '/assignments': 'Who has which customer — assign, reassign, distribute',
  '/teams': 'Teams and their members',
  '/staff': 'Manage assistants, team leaders and managers',
  '/audit-logs': 'Who did what, and when — full history',
  '/settings': 'Call outcomes, categories, tags, mandatory fields, timing',
  '/campaigns': 'Customer groups, scripts, extra fields, priority',
  '/imports': 'Add customers in bulk from CSV / Excel',
  '/reports': 'Assistant, campaign, follow-up reports + CSV export',
};

export default function DashboardPage() {
  const { user } = useAuth();
  // Dashboard default: aaj ke numbers
  const [filters, setFilters] = useState<ReportFilters>({
    ...DEFAULT_FILTERS,
    range: 'today',
  });
  const query = toQuery(filterParams(filters));
  const summary = useApi<ReportSummary>(
    user ? `/reports/summary${query}` : null,
  );
  const lead = user
    ? isManager(user.role) || user.role === 'TEAM_LEADER'
    : false;
  const top = useApi<{ assistants: AssistantReportRow[] }>(
    lead ? `/reports/assistants${query}` : null,
  );
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
        Welcome, {user.name} 👋
      </h1>
      <p className="mt-1 text-slate-500">
        You are logged in as {ROLE_LABELS[user.role]}.
      </p>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {user.role === 'ASSISTANT'
            ? 'My performance'
            : user.role === 'TEAM_LEADER'
              ? 'Team performance'
              : 'Performance'}
        </h2>
        <ReportFilterBar
          value={filters}
          onChange={setFilters}
          showPeople={false}
          showTeam={false}
        />
        {summary.data && (
          <div className={`space-y-4 ${summary.loading ? 'opacity-60' : ''}`}>
            <KpiTiles summary={summary.data} />
            <ReportCharts summary={summary.data} />
          </div>
        )}
      </div>

      {top.data && top.data.assistants.some((a) => a.calls > 0) && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Top assistants
            </h2>
            <Link
              href="/reports"
              className="text-sm text-indigo-600 hover:underline"
            >
              Full report →
            </Link>
          </div>
          <AssistantTable
            rows={top.data.assistants.filter((a) => a.calls > 0).slice(0, 5)}
          />
        </div>
      )}

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
                className="rounded-xl border border-slate-200 bg-white shadow-card p-4 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover"
              >
                <CategoryBadge category={c} />
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {c.count}
                </p>
              </Link>
            ))}
            <Link
              href="/customers?categoryId=none"
              className="rounded-xl border border-slate-200 bg-white shadow-card p-4 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover"
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
            className="rounded-xl border border-slate-200 bg-white shadow-card p-5 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-card-hover"
          >
            <p className="font-medium text-slate-900">{item.label}</p>
            <p className="mt-1 text-sm text-slate-500">
              {DESCRIPTIONS[item.href]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
