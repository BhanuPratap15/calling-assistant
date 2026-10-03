import type { Availability } from '../generated/prisma/enums.js';

/**
 * "Kya ye assistant abhi sach me kaam pe hai?" (design doc section 8.2)
 *   - status AVAILABLE ya ON_CALL hona chahiye (BREAK / OFFLINE = nahi)
 *   - aur haal hi me (presenceTimeout ke andar) koi request aayi ho —
 *     warna browser band karke chala gaya, status purana hai
 * PURE function → unit test aasaan; scheduler + escalation yahi use karte hain.
 */
export function isEffectivelyAvailable(
  staff: {
    availability: Availability;
    lastSeenAt: Date | null;
    isActive: boolean;
  },
  now: Date,
  presenceTimeoutMinutes: number,
): boolean {
  if (!staff.isActive) return false;
  if (staff.availability !== 'AVAILABLE' && staff.availability !== 'ON_CALL')
    return false;
  if (!staff.lastSeenAt) return false;
  return (
    now.getTime() - staff.lastSeenAt.getTime() <=
    presenceTimeoutMinutes * 60_000
  );
}
