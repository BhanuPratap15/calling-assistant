'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AssignModal } from '@/components/assignments/assign-modal';
import { CategoryBadge } from '@/components/categories/category-badge';
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
  type Category,
  type Customer,
  type Paginated,
  type Tag,
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

function CustomersContent() {
  const { user } = useAuth();
  const canEdit = user ? isManager(user.role) : false;
  // Dashboard se ?categoryId=..., import result se ?tagId=... aa sakta hai
  const params = useSearchParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [categoryId, setCategoryId] = useState(params.get('categoryId') ?? '');
  const [tagId, setTagId] = useState(params.get('tagId') ?? ''); // import result se ?tagId=
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ customer?: Customer } | null>(null);
  const [assigning, setAssigning] = useState<Customer | null>(null);
  const debouncedSearch = useDebounce(search.trim());

  const categories = useApi<Category[]>('/categories');
  const tags = useApi<Tag[]>('/tags');
  const customers = useApi<Paginated<Customer>>(
    `/customers${toQuery({
      search: debouncedSearch,
      status,
      priority,
      categoryId,
      tagId,
      sort,
      page,
      pageSize: PAGE_SIZE,
    })}`,
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
            : 'People to call'
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
          aria-label="Filter by category"
          className="w-44"
          value={categoryId}
          onChange={(e) => changeFilter(setCategoryId)(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value="none">Not rated yet</option>
        </Select>
        <Select
          aria-label="Filter by tag"
          className="w-40"
          value={tagId}
          onChange={(e) => changeFilter(setTagId)(e.target.value)}
        >
          <option value="">All tags</option>
          {tags.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
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
        <Select
          aria-label="Sort"
          className="w-44"
          value={sort}
          onChange={(e) => changeFilter(setSort)(e.target.value)}
        >
          <option value="recent">Newest first</option>
          <option value="rating">Highest interest first</option>
        </Select>
      </div>

      <ErrorMessage message={customers.error} />
      {customers.loading && !customers.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        customers.data && (
          <>
            <Table
              headers={[
                'Customer',
                'Phone',
                'Interest',
                'Priority',
                'Status',
                'Assigned to',
                'Calls',
                '',
              ]}
              empty={customers.data.data.length === 0}
            >
              {customers.data.data.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[c.externalId && `ID ${c.externalId}`, c.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {c.tags && c.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags.map(({ tag }) => (
                          <Badge key={tag.id} tone={tag.color}>
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs">
                    {c.phone}
                  </Td>
                  <Td>
                    <CategoryBadge
                      category={c.category}
                      rating={c.interestRating}
                    />
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
                  <Td className="text-xs">
                    {c.assignments?.[0] ? (
                      <>
                        {c.assignments[0].staff.name}
                        <p className="text-slate-400">
                          {humanize(c.assignments[0].status)}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">
                    {c.callCount ?? 0}
                    {c.lastCalledAt && (
                      <p className="text-slate-400">
                        {formatDateTime(c.lastCalledAt)}
                      </p>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {c.status === 'ACTIVE' && !c.assignments?.[0] && (
                      <Button variant="ghost" onClick={() => setAssigning(c)}>
                        Assign
                      </Button>
                    )}
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

      {assigning && (
        <AssignModal
          customer={assigning}
          onClose={() => setAssigning(null)}
          onDone={() => {
            setAssigning(null);
            customers.reload();
          }}
        />
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

export default function CustomersPage() {
  // useSearchParams (?categoryId=) ke liye Suspense zaroori
  return (
    <Suspense>
      <CustomersContent />
    </Suspense>
  );
}
