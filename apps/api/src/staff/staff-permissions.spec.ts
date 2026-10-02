import { canManageRole } from './staff-permissions.js';

describe('canManageRole', () => {
  it.each([
    ['SUPER_ADMIN', 'SUPER_ADMIN', true],
    ['SUPER_ADMIN', 'MANAGER', true],
    ['MANAGER', 'ASSISTANT', true],
    ['MANAGER', 'TEAM_LEADER', true],
    ['MANAGER', 'MANAGER', false],
    ['MANAGER', 'SUPER_ADMIN', false],
    ['TEAM_LEADER', 'ASSISTANT', false],
    ['ASSISTANT', 'ASSISTANT', false],
  ] as const)('%s managing %s → %s', (actor, target, expected) => {
    expect(canManageRole(actor, target)).toBe(expected);
  });
});
