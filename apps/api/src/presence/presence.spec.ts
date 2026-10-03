import { isEffectivelyAvailable } from './presence.js';

const now = new Date('2026-10-03T16:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const base = {
  availability: 'AVAILABLE' as const,
  lastSeenAt: minutesAgo(1),
  isActive: true,
};

describe('isEffectivelyAvailable', () => {
  it('AVAILABLE and seen recently → available', () => {
    expect(isEffectivelyAvailable(base, now, 5)).toBe(true);
  });
  it('ON_CALL counts as available (will get it after current call)', () => {
    expect(
      isEffectivelyAvailable({ ...base, availability: 'ON_CALL' }, now, 5),
    ).toBe(true);
  });
  it.each(['BREAK', 'OFFLINE'] as const)(
    '%s → not available',
    (availability) => {
      expect(isEffectivelyAvailable({ ...base, availability }, now, 5)).toBe(
        false,
      );
    },
  );
  it('AVAILABLE but not seen for longer than timeout (browser closed) → not available', () => {
    expect(
      isEffectivelyAvailable({ ...base, lastSeenAt: minutesAgo(6) }, now, 5),
    ).toBe(false);
    expect(isEffectivelyAvailable({ ...base, lastSeenAt: null }, now, 5)).toBe(
      false,
    );
  });
  it('deactivated staff → not available', () => {
    expect(isEffectivelyAvailable({ ...base, isActive: false }, now, 5)).toBe(
      false,
    );
  });
});
