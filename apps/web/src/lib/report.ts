import type { RangePreset } from './types';

/** Report filters — URL query me jaate hain (dashboard + reports page same) */
export interface ReportFilters {
  range: RangePreset;
  from: string;
  to: string;
  teamId: string;
  staffId: string;
  campaignId: string;
}

export const DEFAULT_FILTERS: ReportFilters = {
  range: '7d',
  from: '',
  to: '',
  teamId: '',
  staffId: '',
  campaignId: '',
};

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom range',
};

/** Filters → API query (khaali values nahi bhejte; custom adhoora ho to 7d) */
export function filterParams(f: ReportFilters) {
  const custom = f.range === 'custom' && f.from && f.to;
  return {
    range: f.range === 'custom' && !custom ? '7d' : f.range,
    from: custom ? f.from : undefined,
    to: custom ? f.to : undefined,
    teamId: f.teamId || undefined,
    staffId: f.staffId || undefined,
    campaignId: f.campaignId || undefined,
  };
}

/** 3725 → "1h 2m", 95 → "1m 35s" */
export function formatTalkTime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${sec % 60}s`;
}

/** 12900 → "12.9K" (stat tiles) */
export function compact(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    notation: n >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n);
}

/** Pichhle period se badlav: { text: "+12%", good: true } — null = compare nahi kar sakte */
export function delta(
  current: number | null,
  previous: number | null,
  mode: 'percent' | 'points' = 'percent',
): { text: string; up: boolean } | null {
  if (current === null || previous === null) return null;
  if (mode === 'points') {
    const d = Math.round((current - previous) * 10) / 10;
    if (d === 0) return { text: '±0', up: true };
    return { text: `${d > 0 ? '+' : ''}${d}`, up: d > 0 };
  }
  if (previous === 0) return null;
  const d = Math.round(((current - previous) / previous) * 100);
  return { text: `${d > 0 ? '+' : ''}${d}%`, up: d >= 0 };
}

/** "2026-10-05" → "5 Oct" */
export function shortDay(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/** Chart colors (dataviz reference palette) — sirf marks ke liye, text kabhi nahi */
export const CHART = {
  accent: '#2a78d6', // series 1 (blue)
  muted: '#c3c2b7', // de-emphasis (not connected)
  grid: '#e1e0d9',
  axis: '#c3c2b7',
};
