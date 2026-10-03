'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { FollowUpSummaryCards } from '@/components/follow-ups/follow-up-summary-cards';
import { ReassignFollowUpModal } from '@/components/follow-ups/reassign-follow-up-modal';
import { RescheduleModal } from '@/components/follow-ups/reschedule-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Table, Td } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import { isManager } from '@/lib/permissions';
import type {
  FollowUp,
  FollowUpBucket,
  FollowUpSummary,
  Paginated,
} from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';
import { useInterval } from '@/lib/use-interval';

const TABS: { bucket: FollowUpBucket; label: string }[] = [
  { bucket: 'open', label: 'All open' },
  { bucket: 'overdue', label: 'Overdue' },
  { bucket: 'due', label: 'Due now' },
  { bucket: 'upcoming', label: 'Upcoming' },
  { bucket: 'completed', label: 'Completed' },
  { bucket: 'cancelled', label: 'Cancelled' },
];

type ModalState = {
  kind: 'reschedule' | 'reassign';
  followUp: FollowUp;
} | null;

function timeLabel(f: FollowUp, now: number) {
  const diffMin = Math.round((new Date(f.dueAt).getTime() - now) / 60_000);
  if (f.status === 'COMPLETED' || f.status === 'CANCELLED') return null;
  if (diffMin > 0)
    return (
      <span className="text-xs text-slate-500">
        in {diffMin < 60 ? `${diffMin} min` : `${Math.round(diffMin / 60)} h`}
      </span>
    );
  return (
    <span className="text-xs font-medium text-red-600">
      {-diffMin < 60 ? `${-diffMin} min` : `${Math.round(-diffMin / 60)} h`}{' '}
      late
    </span>
  );
}

function FollowUpsContent() {
  const { user } = useAuth();
  const params = useSearchParams();
  const initial = (params.get('bucket') as FollowUpBucket | null) ?? 'open';
  const [bucket, setBucket] = useState<FollowUpBucket>(initial);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [error, setError] = useState<string | null>(null);
  // "Abhi" state me — render pure rahe; har minute update ("5 min late" badhta rahe)
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 60_000);

  const list = useApi<Paginated<FollowUp>>(
    `/follow-ups${toQuery({ bucket, page, pageSize: 25 })}`,
  );
  const summary = useApi<FollowUpSummary>('/follow-ups/summary');
  const canManage = user
    ? isManager(user.role) || user.role === 'TEAM_LEADER'
    : false;

  const reload = () => {
    list.reload();
    summary.reload();
  };
  const choose = (b: string) => {
    setBucket(b as FollowUpBucket);
    setPage(1);
  };

  async function cancel(f: FollowUp) {
    if (!window.confirm(`${f.customer.name} ka follow-up cancel karein?`))
      return;
    setError(null);
    try {
      await api(`/follow-ups/${f.id}/cancel`, { method: 'POST' });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description={
          user?.role === 'ASSISTANT'
            ? 'Aapke follow-ups. Due wale "Start Calling" pe sabse pehle milte hain.'
            : user?.role === 'TEAM_LEADER'
              ? 'Aapki team ke follow-ups'
              : 'Saare follow-ups'
        }
        actions={
          user?.role !== 'MANAGER' && user?.role !== 'SUPER_ADMIN' ? (
            <Link href="/calling">
              <Button>▶ Start Calling</Button>
            </Link>
          ) : undefined
        }
      />

      {summary.data && (
        <div className="mb-5">
          <FollowUpSummaryCards summary={summary.data} onSelect={choose} />
        </div>
      )}

      <div
        className="mb-4 flex flex-wrap gap-1 border-b border-slate-200"
        role="tablist"
      >
        {TABS.map((t) => (
          <button
            key={t.bucket}
            role="tab"
            aria-selected={bucket === t.bucket}
            onClick={() => choose(t.bucket)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              bucket === t.bucket
                ? 'border-indigo-600 font-medium text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorMessage message={error ?? list.error} />
      {list.data && (
        <>
          <Table
            headers={['Customer', 'Due', 'Owner', 'Promise', 'Status', '']}
            empty={list.data.data.length === 0}
          >
            {list.data.data.map((f) => {
              const open = f.status === 'PENDING';
              const canReschedule =
                open && (canManage || f.owner.id === user?.id);
              return (
                <tr key={f.id}>
                  <Td>
                    {canManage ? (
                      <Link
                        href={`/customers/${f.customer.id}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {f.customer.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900">
                        {f.customer.name}
                      </p>
                    )}
                    <p className="font-mono text-xs text-slate-500">
                      {f.customer.phone}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p className="text-sm">{formatDateTime(f.dueAt)}</p>
                    {timeLabel(f, now)}
                  </Td>
                  <Td>
                    <p>{f.owner.name}</p>
                    {f.owner.id !== f.originalOwner.id && (
                      <p className="text-xs text-slate-500">
                        promised by {f.originalOwner.name}
                      </p>
                    )}
                    {f.escalationCount > 0 && (
                      <Badge tone="yellow">
                        Escalated ×{f.escalationCount}
                      </Badge>
                    )}
                  </Td>
                  <Td className="max-w-xs text-xs text-slate-600">
                    {f.sourceCall.userResponse && (
                      <p>“{f.sourceCall.userResponse}”</p>
                    )}
                    <p className="text-slate-400">
                      {f.sourceCall.outcome.label}
                      {f.sourceCall.interestRating !== null &&
                        ` · rating ${f.sourceCall.interestRating}`}
                    </p>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        f.status === 'COMPLETED'
                          ? 'green'
                          : f.status === 'CANCELLED'
                            ? 'gray'
                            : f.status === 'IN_PROGRESS'
                              ? 'blue'
                              : 'yellow'
                      }
                    >
                      {f.status === 'IN_PROGRESS'
                        ? 'Calling now'
                        : f.status.charAt(0) + f.status.slice(1).toLowerCase()}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {canReschedule && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setModal({ kind: 'reschedule', followUp: f })
                        }
                      >
                        Reschedule
                      </Button>
                    )}
                    {open && canManage && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setModal({ kind: 'reassign', followUp: f })
                          }
                        >
                          Reassign
                        </Button>
                        <Button variant="ghost" onClick={() => cancel(f)}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
          <Pagination meta={list.data.meta} onPageChange={setPage} />
        </>
      )}

      {modal?.kind === 'reschedule' && (
        <RescheduleModal
          followUp={modal.followUp}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal?.kind === 'reassign' && (
        <ReassignFollowUpModal
          followUp={modal.followUp}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  // useSearchParams (?bucket=overdue) ke liye Suspense zaroori
  return (
    <Suspense>
      <FollowUpsContent />
    </Suspense>
  );
}
