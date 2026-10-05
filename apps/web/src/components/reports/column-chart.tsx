'use client';

import { useState } from 'react';
import { CHART } from '@/lib/report';

export interface ColumnSegment {
  name: string; // "Connected"
  value: number;
  color: string;
}

export interface Column {
  key: string;
  label: string; // x-axis ("5 Oct", "14:00")
  segments: ColumnSegment[]; // neeche se upar stack
  note?: string; // tooltip me extra line ("Connect rate 62%")
}

/** 0 → 1, 7 → 10, 23 → 25, 140 → 200 — gridline ke liye saaf number */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max) ?? 10;
  return step * pow;
}

const HEIGHT = 180;

/**
 * Stacked column chart (plain HTML/CSS — koi chart library nahi).
 * Dataviz specs: bar ≤ 24px, upar 4px round, segments ke beech 2px gap, hairline grid,
 * har column hover + keyboard focus pe tooltip (value pehle, naam baad me).
 */
export function ColumnChart({
  columns,
  legend,
  labelEvery = 1,
  ariaLabel,
}: {
  columns: Column[];
  legend?: { name: string; color: string }[]; // ≥ 2 series ho to
  labelEvery?: number; // har n-th x label (30 din me bheed na ho)
  ariaLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const totals = columns.map((c) =>
    c.segments.reduce((n, s) => n + s.value, 0),
  );
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [0, max / 2, max];

  return (
    <div>
      {legend && legend.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
          {legend.map((l) => (
            <li key={l.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: l.color }}
                aria-hidden
              />
              {l.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        {/* Y axis ticks (muted text, tabular numbers) */}
        <div
          className="relative w-8 text-right text-[11px] tabular-nums text-slate-400"
          style={{ height: HEIGHT }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0"
              style={{
                bottom: `${(t / max) * 100}%`,
                transform: 'translateY(50%)',
              }}
            >
              {Number.isInteger(t) ? t.toLocaleString('en-IN') : t}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative"
            style={{ height: HEIGHT }}
            role="list"
            aria-label={ariaLabel}
          >
            {/* hairline gridlines */}
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0"
                style={{
                  bottom: `${(t / max) * 100}%`,
                  borderTop: `1px solid ${t === 0 ? CHART.axis : CHART.grid}`,
                }}
                aria-hidden
              />
            ))}
            <div className="absolute inset-0 flex items-end">
              {columns.map((col, i) => {
                const total = totals[i];
                const filled = col.segments.filter((s) => s.value > 0);
                const isActive = active === col.key;
                return (
                  <div
                    key={col.key}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${col.label}: ${col.segments.map((s) => `${s.name} ${s.value}`).join(', ')}`}
                    onPointerEnter={() => setActive(col.key)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(col.key)}
                    onBlur={() => setActive(null)}
                    // hit target = poora column slot (bar se bada)
                    className="relative flex h-full flex-1 cursor-default flex-col-reverse items-center px-px outline-none focus-visible:bg-slate-100"
                  >
                    {filled.map((s, si) => (
                      <div
                        key={s.name}
                        className="w-full max-w-6"
                        style={{
                          height: `${(s.value / max) * 100}%`,
                          background: s.color,
                          // 2px surface gap segments ke beech
                          marginTop: si < filled.length - 1 ? 2 : 0,
                          borderRadius:
                            si === filled.length - 1 ? '4px 4px 0 0' : 0,
                          opacity: active && !isActive ? 0.55 : 1,
                        }}
                      />
                    ))}
                    {isActive && (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
                        style={
                          i > columns.length / 2 ? { right: 0 } : { left: 0 }
                        }
                      >
                        <p className="mb-1 text-slate-500">{col.label}</p>
                        <p className="font-semibold text-slate-900">
                          {total.toLocaleString('en-IN')} total
                        </p>
                        {col.segments.map((s) => (
                          <p
                            key={s.name}
                            className="flex items-center gap-1.5 text-slate-700"
                          >
                            <span
                              className="inline-block h-0.5 w-3"
                              style={{ background: s.color }}
                              aria-hidden
                            />
                            <b className="text-slate-900">
                              {s.value.toLocaleString('en-IN')}
                            </b>
                            <span className="text-slate-500">{s.name}</span>
                          </p>
                        ))}
                        {col.note && (
                          <p className="mt-1 text-slate-500">{col.note}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* X axis labels */}
          <div className="mt-1 flex text-[11px] text-slate-400" aria-hidden>
            {columns.map((col, i) => (
              <span
                key={col.key}
                className="flex flex-1 justify-center overflow-visible whitespace-nowrap"
              >
                {i % labelEvery === 0 ? col.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
