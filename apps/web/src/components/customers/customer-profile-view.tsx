import { CategoryBadge } from '@/components/categories/category-badge';
import { TagEditor } from '@/components/categories/tag-editor';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { CAMPAIGN_STATUS_TONE, formatCustomValue } from '@/lib/campaign';
import { formatDateTime, humanize } from '@/lib/format';
import { formatDuration, SESSION_LABEL, SESSION_TONE } from '@/lib/telephony';
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

const CHANGE_REASON: Record<string, string> = {
  call_rating: 'call rating',
  threshold_change: 'threshold change',
};

/**
 * Customer 360° (design doc section 12): details + category + tags + call history + category changes.
 * canEditTags: Manager / TL, ya assistant jiske paas ye customer abhi hai.
 */
export function CustomerProfileView({
  customer,
  canEditTags = false,
  linkCampaigns = false,
  phoneAction,
}: {
  customer: CustomerProfile;
  canEditTags?: boolean;
  linkCampaigns?: boolean; // Manager / TL: campaign pe click → campaign page
  phoneAction?: ReactNode; // calling screen: 📞 provider se dial (DialPanel); warna tel: link
}) {
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
          <div className="flex flex-wrap gap-2">
            <CategoryBadge
              category={customer.category}
              rating={customer.interestRating}
            />
            <Badge tone={PRIORITY_TONE[customer.priority]}>
              {humanize(customer.priority)}
            </Badge>
            <Badge tone={STATUS_TONE[customer.status]}>
              {humanize(customer.status)}
            </Badge>
          </div>
        </div>

        {phoneAction ?? (
          <>
            {/* tel: link — mobile/softphone pe click karte hi dial */}
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
          </>
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
            <dt className="text-slate-500">Interest rating</dt>
            <dd className="font-medium text-slate-900">
              {customer.interestRating ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Assigned to</dt>
            <dd className="font-medium text-slate-900">{assignedTo ?? '—'}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="mb-1 text-sm text-slate-500">Tags</p>
          <TagEditor
            key={customer.id}
            customerId={customer.id}
            tags={customer.tags.map((t) => t.tag)}
            canEdit={canEditTags}
          />
        </div>

        {customer.campaigns.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-sm text-slate-500">Campaigns</p>
            <div className="flex flex-wrap gap-2">
              {customer.campaigns.map(({ campaign, callCount }) => {
                const content = (
                  <>
                    📣 {campaign.name}
                    <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]}>
                      {humanize(campaign.status)}
                    </Badge>
                    <span className="text-slate-400">
                      {callCount ? `${callCount} call(s)` : 'pending'}
                    </span>
                  </>
                );
                const cls =
                  'inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs';
                return linkCampaigns ? (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className={`${cls} hover:bg-slate-50`}
                  >
                    {content}
                  </Link>
                ) : (
                  <span key={campaign.id} className={cls}>
                    {content}
                  </span>
                );
              })}
            </div>
          </div>
        )}

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
          <p className="text-sm text-slate-400">First call to this customer</p>
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
                  {call.campaign && (
                    <Badge tone="indigo">📣 {call.campaign.name}</Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    by {call.staff.name}
                  </span>
                </div>
                {call.customFields &&
                  Object.keys(call.customFields).length > 0 && (
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {Object.entries(call.customFields).map(([key, value]) => (
                        <div key={key}>
                          <dt className="inline text-slate-500">
                            {humanize(key)}:
                          </dt>{' '}
                          <dd className="inline font-medium text-slate-800">
                            {formatCustomValue(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                {call.userResponse && (
                  <p className="mt-1 text-sm text-slate-700">
                    “{call.userResponse}”
                  </p>
                )}
                {call.notes && (
                  <p className="mt-1 text-sm text-slate-600">{call.notes}</p>
                )}
                {call.telephony.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    {call.telephony.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1"
                      >
                        <Badge tone={SESSION_TONE[t.status]}>
                          📞 {SESSION_LABEL[t.status]}
                          {t.status === 'COMPLETED' &&
                            ` · ${formatDuration(t.durationSec)}`}
                        </Badge>
                        {t.recordingUrl && (
                          <a
                            href={t.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline"
                          >
                            ▶ Recording
                          </a>
                        )}
                      </span>
                    ))}
                  </div>
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

      {customer.categoryChanges.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-semibold text-slate-900">
            Category changes
          </h3>
          <ol className="space-y-2">
            {customer.categoryChanges.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="text-slate-500">
                  {formatDateTime(c.createdAt)}
                </span>
                <CategoryBadge category={c.from} />
                <span className="text-slate-400">→</span>
                <CategoryBadge category={c.to} rating={c.rating} />
                <span className="text-xs text-slate-400">
                  {CHANGE_REASON[c.reason] ?? c.reason}
                  {c.changedBy && ` · ${c.changedBy.name}`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
