import { CHART } from '@/lib/report';
import type { ReportSummary } from '@/lib/types';

/**
 * Outcome-wise calls — horizontal bars, ek hi rang (magnitude), value bar ke aage.
 * Connected / not connected text me (rang se nahi).
 */
export function OutcomeBars({
  outcomes,
}: {
  outcomes: ReportSummary['outcomes'];
}) {
  const total = outcomes.reduce((n, o) => n + o.calls, 0);
  const max = Math.max(1, ...outcomes.map((o) => o.calls));
  if (!total)
    return <p className="text-sm text-slate-400">Is period me koi call nahi</p>;
  return (
    <ul className="space-y-2" aria-label="Calls by outcome">
      {outcomes.map((o) => (
        <li
          key={o.label}
          className="grid grid-cols-[8.5rem_1fr] items-center gap-3 text-sm"
          title={`${o.label}: ${o.calls} (${Math.round((o.calls / total) * 100)}%)`}
        >
          <span className="leading-tight text-slate-700">
            {o.label}
            {o.isConnected && (
              <span className="block text-xs text-slate-400">connected</span>
            )}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3 rounded-r"
              style={{
                width: `${Math.max(2, (o.calls / max) * 85)}%`,
                background: CHART.accent,
              }}
            />
            <span className="text-xs tabular-nums text-slate-600">
              {o.calls}{' '}
              <span className="text-slate-400">
                ({Math.round((o.calls / total) * 100)}%)
              </span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Meter: same-ramp track (light blue) + fill (accent) — connect rate / progress */
export function Meter({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full"
        style={{ background: '#cde2fb' }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${value ?? 0}%`, background: CHART.accent }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-600">
        {value === null ? '—' : `${value}%`}
      </span>
    </div>
  );
}
