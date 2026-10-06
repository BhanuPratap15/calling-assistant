'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { formatDateTime, humanize } from '@/lib/format';
import { IMPORT_STATUS_TONE } from '@/lib/import';
import type { ImportBatch, Paginated } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

/** Import history (design doc 16: "who imported, when, batch size and failures") */
export default function ImportsPage() {
  const [page, setPage] = useState(1);
  const list = useApi<Paginated<ImportBatch>>(
    `/imports${toQuery({ page, pageSize: 20 })}`,
  );

  return (
    <div>
      <PageHeader
        title="Import"
        description="Add customers in bulk from CSV / Excel — preview first, then confirm"
        actions={
          <Link
            href="/imports/new"
            className="rounded-lg bg-indigo-600 shadow-brand px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New import
          </Link>
        }
      />
      <ErrorMessage message={list.error} />
      {list.loading && !list.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        list.data && (
          <>
            <Table
              headers={[
                'File',
                'Status',
                'Rows',
                'Imported',
                'Problems',
                'By',
                'When',
              ]}
              empty={list.data.data.length === 0}
            >
              {list.data.data.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <Link
                      href={`/imports/${b.id}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {b.fileName}
                    </Link>
                    {(b.campaign || b.tag) && (
                      <p className="text-xs text-slate-500">
                        {[
                          b.campaign && `📣 ${b.campaign.name}`,
                          b.tag && `🏷 ${b.tag.name}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={IMPORT_STATUS_TONE[b.status]}>
                      {humanize(b.status)}
                    </Badge>
                  </Td>
                  <Td>{b.totalRows}</Td>
                  <Td>
                    {b.status === 'PREVIEW' || b.status === 'CANCELLED'
                      ? `— (${b.validRows} valid)`
                      : b.importedRows}
                  </Td>
                  <Td className="text-xs">
                    {b.invalidRows + b.duplicateRows + b.skippedRows === 0 ? (
                      <span className="text-slate-400">none</span>
                    ) : (
                      [
                        b.invalidRows && `${b.invalidRows} invalid`,
                        b.duplicateRows && `${b.duplicateRows} duplicate`,
                        b.skippedRows && `${b.skippedRows} skipped`,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    )}
                  </Td>
                  <Td className="text-xs">{b.createdBy?.name ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDateTime(b.createdAt)}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={list.data.meta} onPageChange={setPage} />
          </>
        )
      )}
    </div>
  );
}
