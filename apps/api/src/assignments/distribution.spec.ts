import { planDistribution } from './distribution.js';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);
const count = (plan: { staffId: string }[]) =>
  plan.reduce<Record<string, number>>((m, p) => {
    m[p.staffId] = (m[p.staffId] ?? 0) + 1;
    return m;
  }, {});

describe('planDistribution', () => {
  const staff = [
    { id: 'A', load: 0 },
    { id: 'B', load: 0 },
    { id: 'C', load: 0 },
  ];

  it('ROUND_ROBIN: baari baari A, B, C, A…', () => {
    const plan = planDistribution(ids(7), staff, 'ROUND_ROBIN');
    expect(plan.map((p) => p.staffId).join('')).toBe('ABCABCA');
    expect(plan.map((p) => p.customerId)).toEqual(ids(7)); // priority order bana rehta hai
  });

  it('ROUND_ROBIN ignores existing load (sabko barabar naye)', () => {
    const plan = planDistribution(
      ids(6),
      [
        { id: 'A', load: 50 },
        { id: 'B', load: 0 },
      ],
      'ROUND_ROBIN',
    );
    expect(count(plan)).toEqual({ A: 3, B: 3 });
  });

  it('LOAD_BASED: kam load wale ko pehle — aakhir me sab barabar', () => {
    const plan = planDistribution(
      ids(9),
      [
        { id: 'A', load: 5 },
        { id: 'B', load: 2 },
        { id: 'C', load: 0 },
      ],
      'LOAD_BASED',
    );
    // total load 7 + 9 naye = 16 → final ~5 / 5 / 6; A (pehle se 5) ko 0–1 hi milte
    const c = count(plan);
    expect(c.A ?? 0).toBeLessThanOrEqual(1);
    const finals = [5 + (c.A ?? 0), 2 + (c.B ?? 0), 0 + (c.C ?? 0)];
    expect(Math.max(...finals) - Math.min(...finals)).toBeLessThanOrEqual(1);
    expect(plan[0].staffId).toBe('C'); // sabse khali
  });

  it('LOAD_BASED tie → list order (deterministic)', () => {
    const plan = planDistribution(ids(3), staff, 'LOAD_BASED');
    expect(plan.map((p) => p.staffId).join('')).toBe('ABC');
  });

  it('perStaffLimit: har assistant max N; baaki customers unassigned', () => {
    for (const strategy of ['ROUND_ROBIN', 'LOAD_BASED'] as const) {
      const plan = planDistribution(ids(10), staff, strategy, 2);
      expect(plan).toHaveLength(6);
      expect(count(plan)).toEqual({ A: 2, B: 2, C: 2 });
      expect(plan.map((p) => p.customerId)).toEqual(ids(6)); // top priority wale hi baante
    }
  });

  it('kam customers / koi staff nahi', () => {
    expect(planDistribution(ids(2), staff, 'ROUND_ROBIN')).toHaveLength(2);
    expect(planDistribution(ids(5), [], 'LOAD_BASED')).toEqual([]);
    expect(planDistribution([], staff, 'LOAD_BASED')).toEqual([]);
  });

  it('har customer sirf ek baar', () => {
    const plan = planDistribution(ids(100), staff, 'LOAD_BASED');
    expect(new Set(plan.map((p) => p.customerId)).size).toBe(100);
  });
});
