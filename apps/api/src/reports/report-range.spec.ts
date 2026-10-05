import { csvCell, toCsv } from '../common/csv.js';
import {
  dayInZone,
  previousRange,
  resolveRange,
  zonedMidnight,
} from './report-range.js';

const IST = 'Asia/Kolkata';
// 5 Oct 2026, 02:00 IST = 4 Oct 20:30 UTC → India me "aaj" 5 Oct hai, UTC me 4 Oct
const now = new Date('2026-10-04T20:30:00Z');

describe('report ranges (India time)', () => {
  it('"today" follows the business time zone, not UTC', () => {
    expect(dayInZone(now, IST)).toBe('2026-10-05');
    const r = resolveRange({ preset: 'today', now, tz: IST });
    expect(r.days).toEqual(['2026-10-05']);
    expect(r.start.toISOString()).toBe('2026-10-04T18:30:00.000Z'); // 00:00 IST
    expect(r.end.toISOString()).toBe('2026-10-05T18:30:00.000Z');
  });

  it('yesterday / 7d / 30d presets', () => {
    expect(resolveRange({ preset: 'yesterday', now, tz: IST }).days).toEqual([
      '2026-10-04',
    ]);
    const week = resolveRange({ preset: '7d', now, tz: IST });
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toBe('2026-09-29');
    expect(week.days[6]).toBe('2026-10-05');
    expect(resolveRange({ preset: '30d', now, tz: IST }).days).toHaveLength(30);
  });

  it('custom range is inclusive and validated', () => {
    const r = resolveRange({
      preset: 'custom',
      from: '2026-09-28',
      to: '2026-10-01',
      now,
      tz: IST,
    });
    expect(r.days).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
    expect(r.end.toISOString()).toBe('2026-10-01T18:30:00.000Z');
    expect(() =>
      resolveRange({
        preset: 'custom',
        from: '2026-10-02',
        to: '2026-10-01',
        now,
        tz: IST,
      }),
    ).toThrow('from must be on or before to');
    expect(() =>
      resolveRange({
        preset: 'custom',
        from: '1/10/2026',
        to: '2026-10-01',
        now,
        tz: IST,
      }),
    ).toThrow('YYYY-MM-DD');
    expect(() =>
      resolveRange({
        preset: 'custom',
        from: '2024-01-01',
        to: '2026-01-01',
        now,
        tz: IST,
      }),
    ).toThrow('Range too long');
  });

  it('previous period has the same length, ending where this one starts', () => {
    const week = resolveRange({ preset: '7d', now, tz: IST });
    const prev = previousRange(week, IST);
    expect(prev.end).toEqual(week.start);
    expect(prev.start.toISOString()).toBe(
      zonedMidnight('2026-09-22', IST).toISOString(),
    );
  });

  it('works for a zone with DST too', () => {
    // New York: 8 Mar 2026 ko DST shuru — midnight phir bhi sahi
    expect(zonedMidnight('2026-03-09', 'America/New_York').toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
    expect(zonedMidnight('2026-03-07', 'America/New_York').toISOString()).toBe(
      '2026-03-07T05:00:00.000Z',
    );
  });
});

describe('csv helpers', () => {
  it('escapes and adds BOM', () => {
    expect(csvCell(new Date('2026-10-05T00:00:00Z'))).toBe(
      '2026-10-05T00:00:00.000Z',
    );
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('﻿a,b\r\n1,"x,y"\r\n');
  });
});
