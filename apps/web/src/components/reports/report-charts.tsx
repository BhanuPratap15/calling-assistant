'use client';

import { CHART, shortDay } from '@/lib/report';
import type { ReportSummary } from '@/lib/types';
import { ColumnChart } from './column-chart';
import { OutcomeBars } from './outcome-bars';

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-card p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {sub && <p className="mb-3 text-xs text-slate-500">{sub}</p>}
      {children}
    </section>
  );
}

/** Daily trend + best hour + outcomes (same filters) */
export function ReportCharts({ summary }: { summary: ReportSummary }) {
  const { daily, byHour, outcomes } = summary;
  const legend = [
    { name: 'Connected', color: CHART.accent },
    { name: 'Not connected', color: CHART.muted },
  ];
  const columns = (
    rows: { calls: number; connected: number }[],
    label: (i: number) => string,
    key: (i: number) => string,
  ) =>
    rows.map((r, i) => ({
      key: key(i),
      label: label(i),
      segments: [
        { name: 'Connected', value: r.connected, color: CHART.accent },
        {
          name: 'Not connected',
          value: r.calls - r.connected,
          color: CHART.muted,
        },
      ],
      note: r.calls
        ? `Connect rate ${Math.round((r.connected / r.calls) * 100)}%`
        : undefined,
    }));

  // Hour chart: sirf kaam ke ghante (jahan calls hain, kam se kam 9–20)
  const active = byHour.filter((h) => h.calls > 0).map((h) => h.hour);
  const from = Math.min(9, ...active);
  const to = Math.max(20, ...active);
  const hours = byHour.slice(from, to + 1);
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

  return (
    <div className="space-y-4">
      {summary.range.preset !== 'today' &&
        summary.range.preset !== 'yesterday' && (
          <Card
            title="Calls per day"
            sub="Connected vs not connected — hover or Tab to a column for exact numbers"
          >
            <ColumnChart
              ariaLabel="Calls per day"
              legend={legend}
              labelEvery={daily.length > 10 ? Math.ceil(daily.length / 8) : 1}
              columns={columns(
                daily,
                (i) => shortDay(daily[i].day),
                (i) => daily[i].day,
              )}
            />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-indigo-600">
                Table view
              </summary>
              <table className="mt-2 w-full text-xs tabular-nums">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1 font-medium">Day</th>
                    <th className="py-1 font-medium">Calls</th>
                    <th className="py-1 font-medium">Connected</th>
                    <th className="py-1 font-medium">Connect rate</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d) => (
                    <tr
                      key={d.day}
                      className="border-t border-slate-100 text-slate-700"
                    >
                      <td className="py-1">{shortDay(d.day)}</td>
                      <td className="py-1">{d.calls}</td>
                      <td className="py-1">{d.connected}</td>
                      <td className="py-1">
                        {d.calls
                          ? `${Math.round((d.connected / d.calls) * 100)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Card>
        )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Best time to call"
          sub="Calls by hour (India time) — when customers pick up most"
        >
          <ColumnChart
            ariaLabel="Calls by hour"
            legend={legend}
            labelEvery={2}
            columns={columns(
              hours,
              (i) => hourLabel(hours[i].hour),
              (i) => String(hours[i].hour),
            )}
          />
        </Card>
        <Card title="Call outcomes" sub="How often each outcome was chosen">
          <OutcomeBars outcomes={outcomes} />
        </Card>
      </div>
    </div>
  );
}
