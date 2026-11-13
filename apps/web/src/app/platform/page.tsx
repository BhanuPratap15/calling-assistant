'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';
import {
  DIALER_MODES,
  DOMAIN_TONE,
  type OrgListItem,
  type PlatformOverview,
} from '@/lib/platform';
import { useDebounce } from '@/lib/use-debounce';
import { toQuery, useApi } from '@/lib/use-api';

export default function PlatformClientsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounce(search, 300);
  const overview = useApi<PlatformOverview>('/platform/overview');
  const { data, loading, error } = useApi<OrgListItem[]>(
    `/platform/organizations${toQuery({ search: q, status })}`,
  );

  const o = overview.data;
  return (
    <>
      <PageHeader
        title="Clients"
        description="Every white-label workspace running on this platform"
        actions={
          <Link
            href="/platform/organizations/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-brand hover:bg-indigo-700"
          >
            <Icon name="plus" className="h-4 w-4" /> New client
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Active clients', o?.organizations.active],
          ['Suspended', o?.organizations.suspended],
          ['Active users', o?.activeStaff],
          ['Calls (30 days)', o?.callsLast30Days?.toLocaleString('en-IN')],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {value ?? '—'}
            </p>
          </div>
        ))}
      </div>
      {o && o.domainsPending > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {o.domainsPending} domain(s) waiting for DNS / SSL — open the client →
          Domains to check.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search name, slug or brand…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-40"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !data && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((org) => {
          const primary =
            org.domains.find((d) => d.isPrimary) ?? org.domains[0];
          return (
            <Link
              key={org.id}
              href={`/platform/organizations/${org.id}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-card hover:border-indigo-300 hover:shadow-card-hover"
            >
              <div className="flex items-start gap-3">
                <BrandMark
                  size={44}
                  logoUrl={org.logoUrl}
                  name={org.brandName}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 group-hover:text-indigo-700">
                    {org.brandName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {org.name} · {org.slug}
                  </p>
                </div>
                <Badge tone={org.status === 'ACTIVE' ? 'green' : 'red'}>
                  {org.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                </Badge>
              </div>
              {primary && (
                <p className="mt-3 flex items-center gap-1.5 truncate text-xs text-slate-600">
                  <Icon name="globe" className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{primary.hostname}</span>
                  <Badge tone={DOMAIN_TONE[primary.status]}>
                    {primary.status === 'ACTIVE'
                      ? 'live'
                      : primary.status.toLowerCase()}
                  </Badge>
                </p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <Stat
                  label="Users"
                  value={`${org.usage.activeStaff}${org.maxStaff ? `/${org.maxStaff}` : ''}`}
                />
                <Stat
                  label="Customers"
                  value={org.usage.customers.toLocaleString('en-IN')}
                />
                <Stat
                  label="Calls 30d"
                  value={org.usage.callsLast30Days.toLocaleString('en-IN')}
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {org.plan ? `${org.plan} · ` : ''}
                {DIALER_MODES[org.dialerMode].label} · last call{' '}
                {formatDateTime(org.usage.lastCallAt)}
              </p>
            </Link>
          );
        })}
      </div>
      {data && data.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          No clients found.
        </p>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
