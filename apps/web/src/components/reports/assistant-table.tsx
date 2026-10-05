import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, Td } from '@/components/ui/table';
import { formatDateTime, humanize } from '@/lib/format';
import { formatTalkTime } from '@/lib/report';
import type { AssistantReportRow, CampaignReportRow } from '@/lib/types';
import { Meter } from './outcome-bars';

const AVAILABILITY_TONE = {
  AVAILABLE: 'green',
  ON_CALL: 'blue',
  BREAK: 'yellow',
  OFFLINE: 'gray',
} as const;

export function AssistantTable({ rows }: { rows: AssistantReportRow[] }) {
  return (
    <Table
      headers={[
        'Assistant',
        'Calls',
        'Connect rate',
        'Avg rating',
        'Talk time',
        'Follow-ups',
        'Overdue',
        'Now',
      ]}
      empty={rows.length === 0}
    >
      {rows.map((a) => (
        <tr key={a.id}>
          <Td>
            <p className="font-medium text-slate-900">{a.name}</p>
            <p className="text-xs text-slate-500">
              {a.team ?? 'No team'}
              {a.role === 'TEAM_LEADER' && ' · TL'}
            </p>
          </Td>
          <Td className="tabular-nums">
            {a.calls}
            <p className="text-xs text-slate-400">{a.connected} connected</p>
          </Td>
          <Td>
            <Meter
              value={a.connectRate}
              label={`${a.connected} of ${a.calls} connected`}
            />
          </Td>
          <Td className="tabular-nums">{a.avgRating ?? '—'}</Td>
          <Td className="whitespace-nowrap tabular-nums">
            {formatTalkTime(a.talkTimeSec)}
            {a.avgTalkSec !== null && (
              <p className="text-xs text-slate-400">
                avg {formatTalkTime(a.avgTalkSec)}
              </p>
            )}
          </Td>
          <Td className="whitespace-nowrap text-xs tabular-nums">
            {a.followUpsCompleted}/{a.followUpsDue} done
            <p className="text-slate-400">{a.followUpsPromised} promised</p>
          </Td>
          <Td>
            {a.overdueNow ? (
              <Badge tone="red">⚠ {a.overdueNow}</Badge>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </Td>
          <Td className="whitespace-nowrap text-xs">
            <Badge tone={AVAILABILITY_TONE[a.availability]}>
              {humanize(a.availability)}
            </Badge>
            {a.lastCallAt && (
              <p className="mt-1 text-slate-400">
                last call {formatDateTime(a.lastCallAt)}
              </p>
            )}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

export function CampaignTable({ rows }: { rows: CampaignReportRow[] }) {
  return (
    <Table
      headers={[
        'Campaign',
        'Status',
        'Progress (all time)',
        'Calls (period)',
        'Connect rate',
        'Avg rating',
      ]}
      empty={rows.length === 0}
    >
      {rows.map((c) => (
        <tr key={c.id}>
          <Td>
            <Link
              href={`/campaigns/${c.id}`}
              className="font-medium text-indigo-700 hover:underline"
            >
              {c.name}
            </Link>
            <p className="text-xs text-slate-500">priority {c.priority}</p>
          </Td>
          <Td>
            <Badge
              tone={
                c.status === 'ACTIVE'
                  ? 'green'
                  : c.status === 'PAUSED'
                    ? 'yellow'
                    : 'gray'
              }
            >
              {humanize(c.status)}
            </Badge>
          </Td>
          <Td>
            <Meter
              value={c.progress}
              label={`${c.called} of ${c.customers} called`}
            />
            <p className="mt-1 text-xs text-slate-400">
              {c.called}/{c.customers} customers
            </p>
          </Td>
          <Td className="tabular-nums">{c.calls}</Td>
          <Td>
            <Meter
              value={c.connectRate}
              label={`${c.connected} of ${c.calls} connected`}
            />
          </Td>
          <Td className="tabular-nums">{c.avgRating ?? '—'}</Td>
        </tr>
      ))}
    </Table>
  );
}
