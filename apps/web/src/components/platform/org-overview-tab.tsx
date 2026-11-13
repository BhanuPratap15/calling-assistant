'use client';

import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import {
  DIALER_MODES,
  DOMAIN_LABEL,
  DOMAIN_TONE,
  type OrgDetail,
} from '@/lib/platform';
import { THEME_PRESETS } from '@/lib/theme';
import { Section } from './section';

export function OrgOverviewTab({ org }: { org: OrgDetail }) {
  const u = org.usage;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            'Active users',
            `${u.activeStaff}${org.maxStaff ? ` / ${org.maxStaff}` : ''}`,
          ],
          ['Customers', u.customers.toLocaleString('en-IN')],
          ['Calls (30 days)', u.callsLast30Days.toLocaleString('en-IN')],
          ['Last call', formatDateTime(u.lastCallAt)],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <p className="text-xs text-slate-500">{k}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Workspace">
          <dl className="space-y-2 text-sm">
            <Row k="Theme">
              {org.primaryColor
                ? `Custom ${org.primaryColor.toUpperCase()}`
                : (THEME_PRESETS[org.themePreset]?.label ??
                  org.themePreset)}{' '}
              · {org.sidebarStyle} sidebar · {org.loginStyle} login
            </Row>
            <Row k="Dialer">{DIALER_MODES[org.dialerMode].label}</Row>
            {org.externalDialerUrl && (
              <Row k="Dialer link">{org.externalDialerUrl}</Row>
            )}
            <Row k="Plan">{org.plan ?? '—'}</Row>
            <Row k="Last login">{formatDateTime(u.lastLoginAt)}</Row>
            <Row k="Created">{formatDateTime(org.createdAt)}</Row>
          </dl>
        </Section>
        <Section title="Domains">
          <ul className="space-y-2 text-sm">
            {org.domains.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="truncate font-mono text-slate-800">
                  {d.hostname}
                </span>
                {d.isPrimary && <Badge tone="indigo">primary</Badge>}
                <Badge tone={DOMAIN_TONE[d.status]}>
                  {DOMAIN_LABEL[d.status]}
                </Badge>
              </li>
            ))}
            {!org.domains.length && (
              <li className="text-slate-500">
                No domain yet — add one in the Domains tab.
              </li>
            )}
          </ul>
        </Section>
        <Section title="Client contact">
          <dl className="space-y-2 text-sm">
            <Row k="Name">{org.contactName ?? '—'}</Row>
            <Row k="Email">{org.contactEmail ?? '—'}</Row>
            <Row k="Phone">{org.contactPhone ?? '—'}</Row>
          </dl>
          {org.notes && (
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {org.notes}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 break-words text-slate-900">{children}</dd>
    </div>
  );
}
