import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '../../generated/prisma/enums.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(role: StaffRole): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: '1', name: 'x', email: 'x', role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  const requireRoles = (roles: StaffRole[] | undefined) =>
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  it('allows any logged-in staff when no @Roles is set', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor('ASSISTANT'))).toBe(true);
  });

  it('allows a matching role', () => {
    requireRoles(['MANAGER']);
    expect(guard.canActivate(contextFor('MANAGER'))).toBe(true);
  });

  it('always allows SUPER_ADMIN', () => {
    requireRoles(['MANAGER']);
    expect(guard.canActivate(contextFor('SUPER_ADMIN'))).toBe(true);
  });

  it('forbids a non-matching role', () => {
    requireRoles(['MANAGER']);
    expect(() => guard.canActivate(contextFor('ASSISTANT'))).toThrow(
      ForbiddenException,
    );
  });
});
