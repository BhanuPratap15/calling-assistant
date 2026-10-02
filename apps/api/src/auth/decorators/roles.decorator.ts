import { SetMetadata } from '@nestjs/common';
import type { StaffRole } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/**
 * Route sirf in roles ke liye: @Roles('MANAGER', 'TEAM_LEADER')
 * SUPER_ADMIN ko har jagah access hai (RolesGuard me handle).
 * @Roles nahi lagaya = koi bhi logged-in staff access kar sakta hai.
 */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);
