'use client';

import { formatDateTime } from '@/lib/format';
import { ACTION_LABELS, type PlatformAuditEntry } from '@/lib/platform';
import { useApi } from '@/lib/use-api';
import { Section } from './section';

/** Platform audit log — ek client ka (orgId) ya poora platform */
export function OrgActivityTab({ orgId }: { orgId?: string }) {
  const { data, error } = useApi<PlatformAuditEntry[]>(
    orgId
      ? `/platform/organizations/${orgId}/audit-logs`
      : '/platform/audit-logs',
  );
  return (
    <Section
      title="Activity"
      description="Who changed what on the platform (newest first)"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}
      <ul className="divide-y divide-slate-100">
        {data?.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-x-3 py-2.5 text-sm">
            <span className="w-40 shrink-0 text-slate-500">
              {formatDateTime(e.createdAt)}
            </span>
            <span className="font-medium text-slate-900">
              {ACTION_LABELS[e.action] ?? e.action}
            </span>
            <span className="text-slate-500">
              by {e.actor?.name ?? 'system'}
            </span>
            {summary(e) && (
              <span className="w-full pl-0 text-xs text-slate-500 sm:pl-[10.75rem]">
                {summary(e)}
              </span>
            )}
          </li>
        ))}
        {data?.length === 0 && (
          <li className="py-3 text-sm text-slate-500">No activity yet.</li>
        )}
      </ul>
    </Section>
  );
}

function summary(e: PlatformAuditEntry): string {
  if (e.changes)
    return Object.entries(e.changes)
      .map(([k, c]) => `${k}: ${fmt(c.from)} → ${fmt(c.to)}`)
      .join(' · ');
  if (e.metadata)
    return Object.entries(e.metadata)
      .filter(([k]) => k !== 'ip')
      .map(([k, v]) => `${k}: ${fmt(v)}`)
      .join(' · ');
  return '';
}

const fmt = (v: unknown) =>
  v === null || v === undefined
    ? '—'
    : Array.isArray(v)
      ? v.join(', ')
      : String(v);
