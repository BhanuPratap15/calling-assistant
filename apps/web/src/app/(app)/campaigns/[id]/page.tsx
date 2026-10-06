'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CampaignCustomersTab } from '@/components/campaigns/campaign-customers-tab';
import { CampaignFieldsTab } from '@/components/campaigns/campaign-fields-tab';
import { CampaignFormModal } from '@/components/campaigns/campaign-form-modal';
import { CampaignMembersTab } from '@/components/campaigns/campaign-members-tab';
import { ProgressBar } from '@/components/campaigns/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  CAMPAIGN_STATUS_TONE,
  nextStatuses,
  percent,
  statusActionLabel,
} from '@/lib/campaign';
import { formatDateTime, humanize } from '@/lib/format';
import { isManager } from '@/lib/permissions';
import type { CampaignDetail, CampaignStatus } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const TABS = [
  { id: 'customers', label: 'Customers' },
  { id: 'members', label: 'Who calls' },
  { id: 'fields', label: 'Custom fields' },
  { id: 'results', label: 'Results' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** /campaigns/<id> — status, script, customers, members, custom fields, results */
export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user ? isManager(user.role) : false;
  const campaign = useApi<CampaignDetail>(`/campaigns/${id}`);
  const [tab, setTab] = useState<TabId>('customers');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = campaign.data;

  async function changeStatus(to: CampaignStatus) {
    if (
      to === 'COMPLETED' &&
      !window.confirm('A completed campaign cannot be restarted. Are you sure?')
    )
      return;
    setError(null);
    try {
      await api(`/campaigns/${id}`, { method: 'PATCH', body: { status: to } });
      campaign.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <Link
        href="/campaigns"
        className="text-sm text-indigo-600 hover:underline"
      >
        ← All campaigns
      </Link>
      <div className="mt-3" />
      <ErrorMessage message={error ?? campaign.error} />
      {campaign.loading && !c && <p className="text-slate-500">Loading…</p>}
      {c && (
        <>
          <PageHeader
            title={c.name}
            description={c.description ?? undefined}
            actions={
              canEdit && (
                <>
                  {nextStatuses(c.status).map((to) => (
                    <Button
                      key={to}
                      variant={to === 'COMPLETED' ? 'secondary' : 'primary'}
                      onClick={() => changeStatus(to)}
                    >
                      {statusActionLabel(c.status, to)}
                    </Button>
                  ))}
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                </>
              )
            }
          />

          {c.status === 'DRAFT' && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Draft: add customers, set the script / fields, then{' '}
              <b>Activate</b> — only then will assistants get this
              campaign&apos;s customers.
            </p>
          )}

          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4">
              <p className="text-xs text-slate-500">Status</p>
              <div className="mt-1">
                <Badge tone={CAMPAIGN_STATUS_TONE[c.status]}>
                  {humanize(c.status)}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Priority <b className="text-slate-800">{c.priority}</b>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4 md:col-span-2">
              <p className="mb-2 text-xs text-slate-500">Progress</p>
              <ProgressBar done={c.stats.called} total={c.stats.total} />
              <p className="mt-1 text-xs text-slate-500">
                {c.stats.pending} pending
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4 text-xs text-slate-600">
              <p className="mb-1 text-slate-500">Dates</p>
              {c.startsAt || c.endsAt ? (
                <>
                  <p>From {formatDateTime(c.startsAt)}</p>
                  <p>To {formatDateTime(c.endsAt)}</p>
                </>
              ) : (
                <p>No date limit</p>
              )}
              <p className="mt-2 text-slate-500">
                By {c.createdBy?.name ?? '—'}
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-card p-4">
            <p className="mb-1 text-sm font-semibold text-slate-900">
              📜 Call script
            </p>
            {c.script ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {c.script}
              </p>
            ) : (
              <p className="text-sm text-slate-400">No script</p>
            )}
          </div>

          <div
            role="tablist"
            className="mb-4 flex gap-1 border-b border-slate-200"
          >
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
                {t.id === 'customers' && ` (${c.stats.total})`}
                {t.id === 'fields' && ` (${c.fields.length})`}
              </button>
            ))}
          </div>

          {tab === 'customers' && (
            <CampaignCustomersTab
              campaignId={c.id}
              status={c.status}
              canEdit={canEdit}
              onChanged={campaign.reload}
            />
          )}
          {tab === 'members' && (
            <CampaignMembersTab
              campaign={c}
              canEdit={canEdit}
              onSaved={campaign.reload}
            />
          )}
          {tab === 'fields' && (
            <CampaignFieldsTab
              campaignId={c.id}
              fields={c.fields}
              canEdit={canEdit}
              onSaved={campaign.reload}
            />
          )}
          {tab === 'results' && <Results campaign={c} />}

          {editing && (
            <CampaignFormModal
              campaign={c}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                campaign.reload();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Outcome-wise calls (design doc section 15: campaign performance) */
function Results({ campaign }: { campaign: CampaignDetail }) {
  const { byOutcome } = campaign.stats;
  const totalCalls = byOutcome.reduce((sum, o) => sum + o.count, 0);
  const connected = byOutcome
    .filter((o) => o.isConnected)
    .reduce((sum, o) => sum + o.count, 0);

  if (totalCalls === 0)
    return (
      <p className="rounded-xl border border-slate-200 bg-white shadow-card p-5 text-sm text-slate-400">
        No calls in this campaign yet
      </p>
    );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card p-5">
      <p className="mb-4 text-sm text-slate-600">
        <b>{totalCalls}</b> calls · <b>{connected}</b> connected (
        {percent(connected, totalCalls)}%)
      </p>
      <ul className="space-y-2">
        {byOutcome.map((o) => (
          <li
            key={o.label}
            className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm"
          >
            <span className="truncate text-slate-700">{o.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={
                  o.isConnected ? 'h-full bg-green-500' : 'h-full bg-slate-400'
                }
                style={{ width: `${percent(o.count, totalCalls)}%` }}
              />
            </div>
            <span className="text-right font-medium text-slate-900">
              {o.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
