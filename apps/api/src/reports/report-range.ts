/**
 * Report ki date range — PURE (unit tests: report-range.spec.ts).
 * "Aaj" = business time zone (India) ka aaj, server ka UTC nahi.
 * end exclusive: [start, end)
 */
export const RANGE_PRESETS = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'custom',
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const MAX_RANGE_DAYS = 366;

export interface ResolvedRange {
  preset: RangePreset;
  start: Date;
  end: Date;
  days: string[]; // har din "YYYY-MM-DD" (time zone me) — chart ke khaali din bhi
}

export class RangeError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kisi instant ka us time zone me calendar din: "2026-10-05" */
export function dayInZone(instant: Date, tz: string): string {
  // en-CA locale ka format hi YYYY-MM-DD hai
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Time zone me "YYYY-MM-DD 00:00" ka UTC instant */
export function zonedMidnight(day: string, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // us waqt zone ka offset nikaalo (India: +5:30) aur ghata do
  const offset = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return (
      Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second'),
      ) - instant
    );
  };
  const first = guess - offset(guess);
  // DST wale zones me ek baar aur (India me DST nahi, phir bhi sahi rahe)
  return new Date(guess - offset(first));
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function resolveRange(args: {
  preset: RangePreset;
  from?: string;
  to?: string;
  now: Date;
  tz: string;
}): ResolvedRange {
  const today = dayInZone(args.now, args.tz);
  let first: string;
  let last: string; // inclusive
  switch (args.preset) {
    case 'today':
      first = last = today;
      break;
    case 'yesterday':
      first = last = addDays(today, -1);
      break;
    case '7d':
      first = addDays(today, -6);
      last = today;
      break;
    case '30d':
      first = addDays(today, -29);
      last = today;
      break;
    case 'custom': {
      if (
        !args.from ||
        !args.to ||
        !DAY_RE.test(args.from) ||
        !DAY_RE.test(args.to)
      )
        throw new RangeError('custom range needs from and to as YYYY-MM-DD');
      if (args.from > args.to)
        throw new RangeError('from must be on or before to');
      first = args.from;
      last = args.to;
      break;
    }
  }
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    days.push(d);
    if (days.length > MAX_RANGE_DAYS)
      throw new RangeError(`Range too long (max ${MAX_RANGE_DAYS} days)`);
  }
  return {
    preset: args.preset,
    start: zonedMidnight(first, args.tz),
    end: zonedMidnight(addDays(last, 1), args.tz),
    days,
  };
}

/** Pichhli barabar ki range (comparison ke liye: "pichhle 7 din vs usse pehle ke 7") */
export function previousRange(
  r: ResolvedRange,
  tz: string,
): { start: Date; end: Date } {
  const n = r.days.length;
  return {
    start: zonedMidnight(addDays(r.days[0], -n), tz),
    end: r.start,
  };
}
