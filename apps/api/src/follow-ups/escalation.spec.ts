import {
  pickEscalationTarget,
  type EscalationCandidate,
} from './escalation.js';

const c = (
  id: string,
  teamId: string | null,
  openFollowUps: number,
): EscalationCandidate => ({
  id,
  name: id,
  teamId,
  openFollowUps,
});

describe('pickEscalationTarget', () => {
  const owner = { id: 'amit', teamId: 'alpha' };

  it('prefers same-team colleagues over others', () => {
    expect(
      pickEscalationTarget([c('zed', 'beta', 0), c('ravi', 'alpha', 3)], owner)
        ?.id,
    ).toBe('ravi');
  });

  it('picks the least loaded within the team', () => {
    expect(
      pickEscalationTarget(
        [c('ravi', 'alpha', 3), c('neha', 'alpha', 1)],
        owner,
      )?.id,
    ).toBe('neha');
  });

  it('falls back to any available assistant when no teammate is available', () => {
    expect(pickEscalationTarget([c('zed', 'beta', 5)], owner)?.id).toBe('zed');
  });

  it('never picks the owner; returns null when nobody else is available', () => {
    expect(pickEscalationTarget([c('amit', 'alpha', 0)], owner)).toBeNull();
    expect(pickEscalationTarget([], owner)).toBeNull();
  });

  it('ties are broken by name (predictable)', () => {
    expect(
      pickEscalationTarget([c('ravi', null, 1), c('neha', null, 1)], {
        id: 'x',
        teamId: null,
      })?.id,
    ).toBe('neha');
  });
});
