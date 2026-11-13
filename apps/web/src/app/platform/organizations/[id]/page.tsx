'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { OrgAdminsTab } from '@/components/platform/org-admins-tab';
import { OrgActivityTab } from '@/components/platform/org-activity-tab';
import { OrgBrandingTab } from '@/components/platform/org-branding-tab';
import { OrgDomainsTab } from '@/components/platform/org-domains-tab';
import { OrgOverviewTab } from '@/components/platform/org-overview-tab';
import { OrgSettingsTab } from '@/components/platform/org-settings-tab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { api } from '@/lib/api';
import type { OrgDetail } from '@/lib/platform';
import { useApi } from '@/lib/use-api';

const TABS = [
  ['overview', 'Overview'],
  ['branding', 'Branding & theme'],
  ['domains', 'Domains'],
  ['settings', 'Dialer & plan'],
  ['admins', 'Admins'],
  ['activity', 'Activity'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: org,
    error,
    reload,
  } = useApi<OrgDetail>(`/platform/organizations/${id}`);
  const [tab, setTab] = useState<Tab>('overview');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (error && !org) return <p className="text-sm text-red-600">{error}</p>;
  if (!org) return <p className="text-sm text-slate-500">Loading…</p>;

  const primary = org.domains.find((d) => d.isPrimary) ?? org.domains[0];

  async function toggleStatus() {
    if (!org) return;
    const next = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (
      next === 'SUSPENDED' &&
      !window.confirm(
        `Suspend ${org.brandName}? All its users are logged out and cannot log in until you activate it again. Data is kept.`,
      )
    )
      return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await api(`/platform/organizations/${org.id}/status`, {
        method: 'POST',
        body: { status: next },
      });
      reload();
    } catch (e) {
      setStatusError((e as Error).message);
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <>
      <Link
        href="/platform"
        className="mb-4 inline-block text-sm text-indigo-700 hover:underline"
      >
        ← All clients
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <BrandMark size={52} logoUrl={org.logoUrl} name={org.brandName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {org.brandName}
            </h1>
            <Badge tone={org.status === 'ACTIVE' ? 'green' : 'red'}>
              {org.status === 'ACTIVE' ? 'Active' : 'Suspended'}
            </Badge>
            {org.plan && <Badge tone="indigo">{org.plan}</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {org.name} · slug <span className="font-mono">{org.slug}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {primary && (
            <a
              href={`https://${primary.hostname}/login`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <Icon name="external" className="h-4 w-4" /> Open workspace
            </a>
          )}
          <Button
            variant={org.status === 'ACTIVE' ? 'danger' : 'primary'}
            disabled={statusBusy}
            onClick={toggleStatus}
          >
            {org.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      </div>
      {statusError && (
        <p className="mb-4 text-sm text-red-600">{statusError}</p>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === key ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OrgOverviewTab org={org} />}
      {tab === 'branding' && <OrgBrandingTab org={org} onSaved={reload} />}
      {tab === 'domains' && <OrgDomainsTab org={org} onChanged={reload} />}
      {tab === 'settings' && <OrgSettingsTab org={org} onSaved={reload} />}
      {tab === 'admins' && <OrgAdminsTab org={org} onChanged={reload} />}
      {tab === 'activity' && <OrgActivityTab orgId={org.id} />}
    </>
  );
}
