import { Badge } from '@/components/ui/badge';
import { formatDateTime, humanize } from '@/lib/format';
import type { CustomerProfile } from '@/lib/types';

const PRIORITY_TONE = {
  LOW: 'gray',
  NORMAL: 'blue',
  HIGH: 'yellow',
  URGENT: 'red',
} as const;
const STATUS_TONE = {
  ACTIVE: 'green',
  DO_NOT_CALL: 'red',
  INVALID: 'gray',
} as const;

/** Customer 360° (design doc section 12): details + call history */
export function CustomerProfileView({
  customer,
}: {
  customer: CustomerProfile;
}) {
  const latestRating = customer.calls.find(
    (c) => c.interestRating !== null,
  )?.interestRating;
  const assignedTo = customer.assignments[0]?.staff.name;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {customer.name}
            </h2>
            {customer.externalId && (
              <p className="text-xs text-slate-500">
                Platform ID: {customer.externalId}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Badge tone={PRIORITY_TONE[customer.priority]}>
              {humanize(customer.priority)}
            </Badge>
            <Badge tone={STATUS_TONE[customer.status]}>
              {humanize(customer.status)}
            </Badge>
          </div>
        </div>

        {/* tel: link — mobile/softphone pe click karte hi dial (provider integration Phase 7) */}
        <a
          href={`tel:${customer.phone}`}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-mono text-lg font-semibold text-white hover:bg-green-700"
        >
          📞 {customer.phone}
        </a>
        {customer.alternatePhone && (
          <p className="mt-2 text-sm text-slate-600">
            Alternate: {customer.alternatePhone}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Total calls</dt>
            <dd className="font-medium text-slate-900">{customer.callCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Last called</dt>
            <dd className="font-medium text-slate-900">
              {formatDateTime(customer.lastCalledAt)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Last rating</dt>
            <dd className="font-medium text-slate-900">
              {latestRating ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Assigned to</dt>
            <dd className="font-medium text-slate-900">{assignedTo ?? '—'}</dd>
          </div>
        </dl>
        {customer.email && (
          <p className="mt-3 text-sm text-slate-600">Email: {customer.email}</p>
        )}
        {customer.notes && (
          <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            📝 {customer.notes}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-semibold text-slate-900">Call history</h3>
        {customer.calls.length === 0 ? (
          <p className="text-sm text-slate-400">Pehli baar call ho raha hai</p>
        ) : (
          <ol className="space-y-3">
            {customer.calls.map((call) => (
              <li key={call.id} className="border-l-2 border-indigo-200 pl-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500">
                    {formatDateTime(call.createdAt)}
                  </span>
                  <Badge tone={call.outcome.isConnected ? 'blue' : 'gray'}>
                    {call.outcome.label}
                  </Badge>
                  <span className="text-slate-400">→</span>
                  <span className="text-slate-700">
                    {call.nextAction.label}
                  </span>
                  {call.interestRating !== null && (
                    <Badge tone="indigo">Rating {call.interestRating}</Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    by {call.staff.name}
                  </span>
                </div>
                {call.userResponse && (
                  <p className="mt-1 text-sm text-slate-700">
                    “{call.userResponse}”
                  </p>
                )}
                {call.notes && (
                  <p className="mt-1 text-sm text-slate-600">{call.notes}</p>
                )}
                {call.followUpAt && (
                  <p className="mt-1 text-xs text-amber-700">
                    ⏰ Follow-up: {formatDateTime(call.followUpAt)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
