/**
 * Bulk distribution plan — PURE function (unit tests: distribution.spec.ts). Design doc section 9:
 *   ROUND_ROBIN → baari baari: A, B, C, A, B, C… (sabko barabar NAYE customers)
 *   LOAD_BASED  → har customer us assistant ko jiske paas abhi SABSE KAM open kaam hai
 *                 (pehle se bhara assistant kam paata hai → aakhir me sab barabar)
 * "Hybrid" alag se nahi chahiye: pull engine ("Start Calling") khud load-based hai — jo free hai wahi leta hai.
 */
export const DISTRIBUTION_STRATEGIES = ['ROUND_ROBIN', 'LOAD_BASED'] as const;
export type DistributionStrategy = (typeof DISTRIBUTION_STRATEGIES)[number];

export interface DistributionStaff {
  id: string;
  /** Abhi kitne open (ASSIGNED + IN_PROGRESS) customers is assistant ke paas hain */
  load: number;
}

export interface PlannedAssignment {
  customerId: string;
  staffId: string;
}

/**
 * customerIds: priority order me (pehla = sabse zaroori) — pehle wale customers pehle baante jaate hain.
 * perStaffLimit: is run me ek assistant ko max itne naye (baaki customers is baar nahi baante jaate).
 * Tie (barabar load) → staff list ka order (deterministic → test ho sakta hai).
 */
export function planDistribution(
  customerIds: string[],
  staff: DistributionStaff[],
  strategy: DistributionStrategy,
  perStaffLimit?: number,
): PlannedAssignment[] {
  if (!staff.length) return [];
  const cap = perStaffLimit ?? Number.POSITIVE_INFINITY;
  const given = staff.map(() => 0);
  const load = staff.map((s) => s.load);
  const plan: PlannedAssignment[] = [];
  let turn = 0;

  for (const customerId of customerIds) {
    let pick = -1;
    if (strategy === 'ROUND_ROBIN') {
      // agla jiska cap abhi bhara nahi
      for (let k = 0; k < staff.length; k++) {
        const i = (turn + k) % staff.length;
        if (given[i] < cap) {
          pick = i;
          turn = i + 1;
          break;
        }
      }
    } else {
      for (let i = 0; i < staff.length; i++) {
        if (given[i] >= cap) continue;
        if (pick === -1 || load[i] < load[pick]) pick = i;
      }
    }
    if (pick === -1) break; // sabka cap bhar gaya
    plan.push({ customerId, staffId: staff[pick].id });
    given[pick]++;
    load[pick]++;
  }
  return plan;
}
