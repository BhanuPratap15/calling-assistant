'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS, type AuditLog, type Paginated } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

// Backend ke AuditAction se match (apps/api/src/audit/audit.types.ts)
const ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.password_changed',
  'staff.created',
  'staff.updated',
  'staff.password_reset',
  'team.created',
  'team.updated',
  'customer.created',
  'customer.updated',
  'call_outcome.created',
  'call_outcome.updated',
  'next_action.created',
  'next_action.updated',
  'setting.updated',
  'assignment.created',
  'assignment.reassigned',
  'assignment.cancelled',
  'call.completed',
  'call.dialed',
  'staff.availability_changed',
  'follow_up.created',
  'follow_up.completed',
  'follow_up.rescheduled',
  'follow_up.reassigned',
  'follow_up.escalated',
  'follow_up.cancelled',
  'category.updated',
  'customer.category_changed',
  'tag.created',
  'tag.updated',
  'customer.tags_updated',
  'campaign.created',
  'campaign.updated',
  'campaign.members_updated',
  'campaign.customers_added',
  'campaign.customers_removed',
  'campaign.fields_updated',
  'import.previewed',
  'import.confirmed',
  'import.completed',
  'import.failed',
  'import.cancelled',
];
const ENTITY_TYPES = [
  'auth',
  'staff',
  'team',
  'customer',
  'call_outcome',
  'next_action',
  'setting',
  'assignment',
  'call',
  'follow_up',
  'category',
  'tag',
  'campaign',
  'import',
];

const show = (value: unknown) =>
  value === null || value === undefined || value === '' ? '∅' : String(value);

/** changes / metadata ko padhne layak lines me */
function Details({ log }: { log: AuditLog }) {
  if (log.changes) {
    return (
      <ul className="space-y-0.5 text-xs">
        {Object.entries(log.changes).map(([field, { from, to }]) => (
          <li key={field}>
            <span className="font-medium text-slate-600">{field}:</span>{' '}
            <span className="text-red-600 line-through">{show(from)}</span> →{' '}
            <span className="text-green-700">{show(to)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (log.metadata) {
    return (
      <p className="text-xs text-slate-500">
        {Object.entries(log.metadata)
          .map(([k, v]) => `${k}: ${show(v)}`)
          .join(' · ')}
      </p>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const logs = useApi<Paginated<AuditLog>>(
    `/audit-logs${toQuery({ action, entityType, page, pageSize: 25 })}`,
  );

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Kisne, kya, kab kiya — newest first"
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          aria-label="Filter by action"
          className="w-56"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by entity"
          className="w-40"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <ErrorMessage message={logs.error} />
      {logs.loading && !logs.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        logs.data && (
          <>
            <Table
              headers={['Time', 'Who', 'Action', 'Details']}
              empty={logs.data.data.length === 0}
            >
              {logs.data.data.map((log) => (
                <tr key={log.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDateTime(log.createdAt)}
                  </Td>
                  <Td>
                    {log.actor ? (
                      <>
                        <p className="text-slate-900">{log.actor.name}</p>
                        <p className="text-xs text-slate-500">
                          {ROLE_LABELS[log.actor.role]}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">
                        System / Anonymous
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      tone={log.action.endsWith('failed') ? 'red' : 'indigo'}
                    >
                      {log.action}
                    </Badge>
                  </Td>
                  <Td>
                    <Details log={log} />
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={logs.data.meta} onPageChange={setPage} />
          </>
        )
      )}
    </div>
  );
}
