import { diffChanges } from './diff.js';

describe('diffChanges', () => {
  it('returns only changed fields', () => {
    expect(
      diffChanges(
        { name: 'Amit', phone: '1', role: 'ASSISTANT' },
        { name: 'Amit K', phone: '1', role: 'TEAM_LEADER' },
        ['name', 'phone', 'role'],
      ),
    ).toEqual({
      name: { from: 'Amit', to: 'Amit K' },
      role: { from: 'ASSISTANT', to: 'TEAM_LEADER' },
    });
  });

  it('returns undefined when nothing changed', () => {
    expect(diffChanges({ a: 1 }, { a: 1 }, ['a'])).toBeUndefined();
  });

  it('treats undefined and null as the same, compares dates by value', () => {
    const d = new Date('2026-10-02T10:00:00Z');
    expect(
      diffChanges(
        { teamId: null as string | null, at: d },
        { teamId: undefined as unknown as string | null, at: new Date(d) },
        ['teamId', 'at'],
      ),
    ).toBeUndefined();
  });

  it('never logs password hashes', () => {
    expect(
      diffChanges({ passwordHash: 'a' }, { passwordHash: 'b' }, [
        'passwordHash',
      ]),
    ).toBeUndefined();
  });
});
