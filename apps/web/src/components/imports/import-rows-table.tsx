'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { humanize } from '@/lib/format';
import { ROW_STATUS_TONE } from '@/lib/import';
import type { ImportRow, ImportRowStatus, Paginated } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

/**
 * File ki lines — status filter ke saath (preview me "kya galat hai", baad me "kya bana").
 * Parent `key={batch.status}` deta hai → import khatam hote hi table fresh load.
 */
export function ImportRowsTable({
  batchId,
  statuses,
}: {
  batchId: string;
  statuses: ImportRowStatus[]; // filter dropdown me kaunse
}) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const rows = useApi<Paginated<ImportRow>>(
    `/imports/${batchId}/rows${toQuery({ status, page, pageSize: 25 })}`,
  );

  return (
    <div>
      <div className="mb-3">
        <Select
          aria-label="Filter rows by status"
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All rows</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>
      <ErrorMessage message={rows.error} />
      {rows.data && (
        <>
          <Table
            headers={['Row', 'Name', 'Phone', 'Email', 'Status', 'Problem']}
            empty={rows.data.data.length === 0}
          >
            {rows.data.data.map((r) => (
              <tr key={r.id}>
                <Td className="text-xs text-slate-500">{r.rowNumber}</Td>
                <Td>
                  {r.status === 'IMPORTED' && r.customerId ? (
                    <Link
                      href={`/customers/${r.customerId}`}
                      className="text-indigo-700 hover:underline"
                    >
                      {r.raw.name}
                    </Link>
                  ) : (
                    r.raw.name || <span className="text-slate-400">—</span>
                  )}
                </Td>
                <Td className="font-mono text-xs">{r.raw.phone}</Td>
                <Td className="text-xs">{r.raw.email}</Td>
                <Td>
                  <Badge tone={ROW_STATUS_TONE[r.status]}>
                    {humanize(r.status)}
                  </Badge>
                </Td>
                <Td className="text-xs text-red-700">
                  {r.errors.join('; ')}
                  {r.status === 'DUPLICATE' && r.customerId && (
                    <>
                      {' '}
                      <Link
                        href={`/customers/${r.customerId}`}
                        className="text-indigo-700 hover:underline"
                      >
                        view
                      </Link>
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination meta={rows.data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
