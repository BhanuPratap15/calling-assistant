/**
 * Escalation target kaun ho — PURE function (unit test ke liye).
 * Rule (design doc section 8.1 "Find another eligible available assistant"):
 *   1. sirf available candidates (presence check caller karta hai)
 *   2. owner ki team ke log pehle
 *   3. jiske paas sabse kam open follow-ups (load balance)
 *   4. tie → naam (stable / predictable)
 */
export interface EscalationCandidate {
  id: string;
  name: string;
  teamId: string | null;
  openFollowUps: number;
}

export function pickEscalationTarget(
  candidates: EscalationCandidate[],
  owner: { id: string; teamId: string | null },
): EscalationCandidate | null {
  const pool = candidates.filter((c) => c.id !== owner.id);
  if (!pool.length) return null;
  const sameTeam = owner.teamId
    ? pool.filter((c) => c.teamId === owner.teamId)
    : [];
  const ranked = (sameTeam.length ? sameTeam : pool).sort(
    (a, b) => a.openFollowUps - b.openFollowUps || a.name.localeCompare(b.name),
  );
  return ranked[0];
}
