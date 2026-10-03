'use client';

import { useState } from 'react';
import { CustomerFormModal } from '@/components/customers/customer-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, humanize } from '@/lib/format';
import { isManager } from '@/lib/permissions';
import {
  CUSTOMER_STATUSES,
  PRIORITIES,
  type Customer,
  type Paginated,
} from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';
import { useDebounce } from '@/lib/use-debounce';

const STATUS_TONE = {
  ACTIVE: 'green',
  DO_NOT_CALL: 'red',
  INVALID: 'gray',
} as const;
const PRIORITY_TONE = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'yellow',
  URGENT: 'red',
} as const;
const PAGE_SIZE = 20;

export default function CustomersPage() {
  const { user } = useAuth();
  const canEdit = user ? isManager(user.role) : false;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ customer?: Customer } | null>(null);
  const debouncedSearch = useDebounce(search.trim());

  const customers = useApi<Paginated<Customer>>(
    `/customers${toQuery({ search: debouncedSearch, status, priority, page, pageSize: PAGE_SIZE })}`,
  );

  // Filter badla → page 1 pe wapas
  const changeFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description={
          customers.data
            ? `${customers.data.meta.total} customers`
            : 'Jinko call karna hai'
        }
        actions={
          canEdit && (
            <Button onClick={() => setModal({})}>+ Add customer</Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          aria-label="Search customers"
          placeholder="Search name, phone, external ID…"
          className="w-72"
          value={search}
          onChange={(e) => changeFilter(setSearch)(e.target.value)}
        />
        <Select
          aria-label="Filter by status"
          className="w-40"
          value={status}
          onChange={(e) => changeFilter(setStatus)(e.target.value)}
        >
          <option value="">All statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by priority"
          className="w-40"
          value={priority}
          onChange={(e) => changeFilter(setPriority)(e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {humanize(p)}
            </option>
          ))}
        </Select>
      </div>

      <ErrorMessage message={customers.error} />
      {customers.loading && !customers.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        customers.data && (
          <>
            <Table
              headers={['Customer', 'Phone', 'Priority', 'Status', 'Added', '']}
              empty={customers.data.data.length === 0}
            >
              {customers.data.data.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {[c.externalId && `ID ${c.externalId}`, c.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">
                    {c.phone}
                  </Td>
                  <Td>
                    <Badge tone={PRIORITY_TONE[c.priority]}>
                      {humanize(c.priority)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[c.status]}>
                      {humanize(c.status)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {formatDateTime(c.createdAt)}
                  </Td>
                  <Td className="text-right">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        onClick={() => setModal({ customer: c })}
                      >
                        Edit
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination meta={customers.data.meta} onPageChange={setPage} />
          </>
        )
      )}

      {modal && (
        <CustomerFormModal
          customer={modal.customer}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            customers.reload();
          }}
        />
      )}
    </div>
  );
}
