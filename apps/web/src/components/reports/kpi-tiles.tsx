import { compact, delta, formatTalkTime } from '@/lib/report';
import type { ReportSummary } from '@/lib/types';

/** Stat tile: label · value · (optional) badlav pichhle period se */
function Tile({
  label,
  value,
  sub,
  change,
}: {
  label: string;
  value: string;
  sub?: string;
  change?: { text: string; up: boolean } | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">
        {change && (
          // up = achha (calls / connect rate / rating badhna) → green text + ▲ (rang + nishaan dono)
          <span className={change.up ? 'text-green-700' : 'text-red-700'}>
            {change.up ? '▲' : '▼'} {change.text}
          </span>
        )}
        {change && sub && ' · '}
        {sub}
      </p>
    </div>
  );
}

export function KpiTiles({ summary }: { summary: ReportSummary }) {
  const { kpis, previous } = summary;
  const vs = 'vs previous period';
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile
        label="Calls"
        value={compact(kpis.calls)}
        change={delta(kpis.calls, previous.calls)}
        sub={vs}
      />
      <Tile
        label="Connect rate"
        value={kpis.connectRate === null ? '—' : `${kpis.connectRate}%`}
        change={delta(kpis.connectRate, previous.connectRate, 'points')}
        sub={`${compact(kpis.connected)} connected`}
      />
      <Tile
        label="Avg interest rating"
        value={kpis.avgRating === null ? '—' : String(kpis.avgRating)}
        change={delta(kpis.avgRating, previous.avgRating, 'points')}
        sub="out of 10"
      />
      <Tile
        label="Talk time"
        value={formatTalkTime(kpis.talkTimeSec)}
        sub={`${kpis.answered}/${kpis.dials} dials answered`}
      />
      <Tile
        label="Customers reached"
        value={compact(kpis.customers)}
        sub="unique"
      />
      <Tile
        label="Follow-ups promised"
        value={compact(kpis.followUpsPromised)}
        sub="call me later"
      />
    </div>
  );
}

/** Follow-up health — overdue = critical: rang + ⚠ + label (sirf rang nahi) */
export function FollowUpHealth({ f }: { f: ReportSummary['followUps'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        label="Follow-ups due (period)"
        value={compact(f.due)}
        sub={`${f.completed} completed`}
      />
      <Tile
        label="Completed on time"
        value={f.onTimeRate === null ? '—' : `${f.onTimeRate}%`}
        sub={`${f.onTime} of ${f.due} within grace`}
      />
      <Tile
        label="Escalated"
        value={compact(f.escalated)}
        sub="owner unavailable"
      />
      <div
        className={`rounded-lg border p-4 ${f.overdueNow ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}
      >
        <p className="text-xs text-slate-500">Overdue right now</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {f.overdueNow ? '⚠ ' : '✓ '}
          {compact(f.overdueNow)}
        </p>
        <p
          className={`mt-1 text-xs ${f.overdueNow ? 'text-red-700' : 'text-green-700'}`}
        >
          {f.overdueNow ? 'Needs attention' : 'All on track'}
        </p>
      </div>
    </div>
  );
}
