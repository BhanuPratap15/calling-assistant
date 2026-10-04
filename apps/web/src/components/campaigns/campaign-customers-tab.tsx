'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CategoryBadge } from '@/components/categories/category-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Input, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import type { CampaignCustomer, CampaignStatus, Paginated } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';
import { useDebounce } from '@/lib/use-debounce';
import { AddCustomersModal } from './add-customers-modal';

/** Campaign ke customers: pending (abhi call nahi hua) / called + add / remove */
export function CampaignCustomersTab({
  campaignId,
  status,
  canEdit,
  onChanged,
}: {
  campaignId: string;
  status: CampaignStatus;
  canEdit: boolean;
  onChanged: () => void; // stats refresh
}) {
  const [state, setState] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounce(search.trim());
  const list = useApi<Paginated<CampaignCustomer>>(
    `/campaigns/${campaignId}/customers${toQuery({
      state,
      search: debounced,
      page,
      pageSize: 20,
    })}`,
  );

  function refresh() {
    setSelected([]);
    list.reload();
    onChanged();
  }

  async function removeSelected() {
    if (!window.confirm(`${selected.length} customer(s) campaign se hatayein?`))
      return;
    setError(null);
    try {
      await api(`/campaigns/${campaignId}/customers/remove`, {
        method: 'POST',
        body: { customerIds: selected },
      });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const rows = list.data?.data ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label="Filter by call state"
          className="w-44"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All</option>
          <option value="pending">Pending (not called)</option>
          <option value="called">Called</option>
        </Select>
        <Input
          aria-label="Search campaign customers"
          placeholder="Search name…"
          className="w-60"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        {canEdit && (
          <div className="ml-auto flex gap-2">
            {selected.length > 0 && (
              <Button variant="danger" onClick={removeSelected}>
                Remove {selected.length}
              </Button>
            )}
            {status !== 'COMPLETED' && (
              <Button onClick={() => setAdding(true)}>+ Add customers</Button>
            )}
          </div>
        )}
      </div>

      <ErrorMessage message={error ?? list.error} />
      {list.loading && !list.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        list.data && (
          <>
            <Table
              headers={[
                ...(canEdit ? [''] : []),
                'Customer',
                'Interest',
                'Priority',
                'Status',
                'Campaign calls',
                'Added',
              ]}
              empty={rows.length === 0}
            >
              {rows.map(({ customer: c, ...cc }) => (
                <tr key={c.id}>
                  {canEdit && (
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        checked={selected.includes(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </Td>
                  )}
                  <Td>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {c.phone}
                    </p>
                  </Td>
                  <Td>
                    <CategoryBadge
                      category={c.category}
                      rating={c.interestRating}
                    />
                  </Td>
                  <Td>{humanize(c.priority)}</Td>
                  <Td>
                    {c.status === 'ACTIVE' ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="red">{humanize(c.status)}</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {cc.callCount === 0 ? (
                      <Badge tone="yellow">Pending</Badge>
                    ) : (
                      <>
                        {cc.callCount}×
                        <p className="text-slate-400">
                          {formatDateTime(cc.lastCalledAt)}
                        </p>
                      </>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(cc.addedAt)}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={list.data.meta} onPageChange={setPage} />
          </>
        )
      )}

      {adding && (
        <AddCustomersModal
          campaignId={campaignId}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
