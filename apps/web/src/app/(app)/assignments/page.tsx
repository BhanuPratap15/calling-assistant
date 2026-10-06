'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AssignModal } from '@/components/assignments/assign-modal';
import { DistributeModal } from '@/components/assignments/distribute-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import type { Assignment, Paginated } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

const STATUS_TONE = {
  ASSIGNED: 'yellow',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'gray',
} as const;

export default function AssignmentsPage() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [reassign, setReassign] = useState<Assignment | null>(null);
  const [distributing, setDistributing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useApi<Paginated<Assignment>>(
    `/assignments${toQuery({ status, page, pageSize: 25 })}`,
  );
  const isOpen = (a: Assignment) =>
    a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS';

  async function cancel(a: Assignment) {
    if (
      !window.confirm(
        `Take ${a.customer.name} away from ${a.staff.name} and put them back in the pool?`,
      )
    )
      return;
    setError(null);
    try {
      await api(`/assignments/${a.id}/cancel`, { method: 'POST' });
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Who has which customer. One customer: use 'Assign' on the Customers page. Many: Distribute."
        actions={
          <Button onClick={() => setDistributing(true)}>⇄ Distribute</Button>
        }
      />
      {message && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}
      <div className="mb-4">
        <Select
          aria-label="Filter by status"
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="open">Open (queue + calling)</option>
          <option value="ASSIGNED">Queued</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <ErrorMessage message={error ?? list.error} />

      {list.data && (
        <>
          <Table
            headers={[
              'Customer',
              'Assigned to',
              'Status',
              'Source',
              'Since',
              '',
            ]}
            empty={list.data.data.length === 0}
          >
            {list.data.data.map((a) => (
              <tr key={a.id}>
                <Td>
                  <Link
                    href={`/customers/${a.customer.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {a.customer.name}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">
                    {a.customer.phone}
                  </p>
                </Td>
                <Td>{a.staff.name}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[a.status]}>
                    {humanize(a.status)}
                  </Badge>
                </Td>
                <Td className="text-xs">
                  {a.source === 'MANUAL'
                    ? `Manual${a.createdBy ? ` by ${a.createdBy.name}` : ''}`
                    : a.source === 'DISTRIBUTED'
                      ? `Distributed${a.createdBy ? ` by ${a.createdBy.name}` : ''}`
                      : a.source === 'FOLLOW_UP'
                        ? 'Follow-up'
                        : 'Auto (Start Calling)'}
                  {a.campaign && (
                    <p className="text-indigo-700">📣 {a.campaign.name}</p>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs">
                  {formatDateTime(a.startedAt ?? a.createdAt)}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {isOpen(a) && (
                    <>
                      <Button variant="ghost" onClick={() => setReassign(a)}>
                        Reassign
                      </Button>
                      <Button variant="ghost" onClick={() => cancel(a)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </>
      )}

      {distributing && (
        <DistributeModal
          onClose={() => setDistributing(false)}
          onDone={(r) => {
            setDistributing(false);
            setMessage(
              `${r.assigned} customers distributed (${r.strategy === 'LOAD_BASED' ? 'load-based' : 'round-robin'}): ` +
                r.perStaff
                  .filter((p) => p.newCount)
                  .map((p) => `${p.name} +${p.newCount}`)
                  .join(', '),
            );
            setStatus('ASSIGNED');
            setPage(1);
            list.reload();
          }}
        />
      )}
      {reassign && (
        <AssignModal
          customer={reassign.customer}
          reassignId={reassign.id}
          currentStaffId={reassign.staff.id}
          onClose={() => setReassign(null)}
          onDone={() => {
            setReassign(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
