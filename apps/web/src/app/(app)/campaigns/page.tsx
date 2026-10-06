'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CampaignFormModal } from '@/components/campaigns/campaign-form-modal';
import { ProgressBar } from '@/components/campaigns/progress-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { CAMPAIGN_STATUS_TONE } from '@/lib/campaign';
import { formatDateTime, humanize } from '@/lib/format';
import { isManager } from '@/lib/permissions';
import type { Campaign, CampaignStatus } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

const STATUSES: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'];

/** Campaigns list (design doc section 11). Manager banata/chalata hai, TL sirf dekhta hai. */
export default function CampaignsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const canEdit = user ? isManager(user.role) : false;
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const campaigns = useApi<Campaign[]>(`/campaigns${toQuery({ status })}`);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="A group of customers with a script and extra fields — customers of ACTIVE campaigns are called first"
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>+ New campaign</Button>
          )
        }
      />

      <div className="mb-4">
        <Select
          aria-label="Filter by status"
          className="w-44"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
      </div>

      <ErrorMessage message={campaigns.error} />
      {campaigns.loading && !campaigns.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <Table
          headers={[
            'Campaign',
            'Status',
            'Priority',
            'Progress',
            'Who calls',
            'Dates',
          ]}
          empty={campaigns.data?.length === 0}
        >
          {campaigns.data?.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {c.name}
                </Link>
                {c.description && (
                  <p className="max-w-xs truncate text-xs text-slate-500">
                    {c.description}
                  </p>
                )}
              </Td>
              <Td>
                <Badge tone={CAMPAIGN_STATUS_TONE[c.status]}>
                  {humanize(c.status)}
                </Badge>
              </Td>
              <Td>{c.priority}</Td>
              <Td>
                <ProgressBar
                  done={c.progress.called}
                  total={c.progress.total}
                />
              </Td>
              <Td className="text-xs">
                {c._count.staff + c._count.teams === 0
                  ? 'Everyone'
                  : [
                      c._count.staff && `${c._count.staff} staff`,
                      c._count.teams && `${c._count.teams} teams`,
                    ]
                      .filter(Boolean)
                      .join(' + ')}
              </Td>
              <Td className="whitespace-nowrap text-xs">
                {c.startsAt || c.endsAt ? (
                  <>
                    <p>From {formatDateTime(c.startsAt)}</p>
                    <p>To {formatDateTime(c.endsAt)}</p>
                  </>
                ) : (
                  <span className="text-slate-400">No limit</span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {creating && (
        <CampaignFormModal
          onClose={() => setCreating(false)}
          onSaved={(id) => router.push(`/campaigns/${id}`)}
        />
      )}
    </div>
  );
}
