'use client';

import { useState } from 'react';
import {
  AssistantTable,
  CampaignTable,
} from '@/components/reports/assistant-table';
import { FollowUpHealth, KpiTiles } from '@/components/reports/kpi-tiles';
import { ReportCharts } from '@/components/reports/report-charts';
import { ReportFilterBar } from '@/components/reports/report-filter-bar';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth-context';
import { isManager } from '@/lib/permissions';
import {
  DEFAULT_FILTERS,
  filterParams,
  type ReportFilters,
} from '@/lib/report';
import type {
  AssistantReportRow,
  CampaignReportRow,
  ReportSummary,
} from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'assistants', label: 'Assistants' },
  { id: 'campaigns', label: 'Campaigns' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/**
 * Reports (design doc section 15) — Manager: sab; TL: apni team. Ek filter row sab pe lagti hai,
 * CSV export bhi wahi filters use karta hai.
 */
export default function ReportsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<TabId>('overview');
  const [showIdle, setShowIdle] = useState(false); // bina calls wale staff (default chhupe)
  const query = toQuery(filterParams(filters));

  const summary = useApi<ReportSummary>(
    tab === 'overview' ? `/reports/summary${query}` : null,
  );
  const assistants = useApi<{ assistants: AssistantReportRow[] }>(
    tab === 'assistants' ? `/reports/assistants${query}` : null,
  );
  const campaigns = useApi<{ campaigns: CampaignReportRow[] }>(
    tab === 'campaigns' ? `/reports/campaigns${query}` : null,
  );
  if (!user) return null;
  const current =
    tab === 'overview'
      ? summary
      : tab === 'assistants'
        ? assistants
        : campaigns;

  return (
    <div>
      <PageHeader
        title="Reports"
        description={
          isManager(user.role)
            ? 'Poori team ka performance'
            : 'Aapki team ka performance'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {(['calls', 'assistants', 'campaigns'] as const).map((type) => (
              // Same filters wala CSV (browser cookie se auth) — download audit log me jaata hai
              <a
                key={type}
                href={`/api/reports/export/${type}.csv${query}`}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ⬇ {type} CSV
              </a>
            ))}
          </div>
        }
      />
      <ReportFilterBar
        value={filters}
        onChange={setFilters}
        showPeople
        showTeam={isManager(user.role)}
      />

      <div role="tablist" className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorMessage message={current.error} />
      {current.loading && !current.data && (
        <p className="text-slate-500">Loading…</p>
      )}
      {/* Refetch: purana data dikhta rahe (halka), jump nahi */}
      <div
        className={
          current.loading
            ? 'opacity-60 transition-opacity'
            : 'transition-opacity'
        }
      >
        {tab === 'overview' && summary.data && (
          <div className="space-y-4">
            <KpiTiles summary={summary.data} />
            <ReportCharts summary={summary.data} />
            <h3 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Follow-up health
            </h3>
            <FollowUpHealth f={summary.data.followUps} />
          </div>
        )}
        {tab === 'assistants' && assistants.data && (
          <>
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showIdle}
                onChange={(e) => setShowIdle(e.target.checked)}
              />
              Bina calls wale staff bhi dikhao (
              {assistants.data.assistants.filter((a) => a.calls === 0).length})
            </label>
            <AssistantTable
              rows={assistants.data.assistants.filter(
                (a) => showIdle || a.calls > 0,
              )}
            />
          </>
        )}
        {tab === 'campaigns' && campaigns.data && (
          <CampaignTable rows={campaigns.data.campaigns} />
        )}
      </div>
    </div>
  );
}
