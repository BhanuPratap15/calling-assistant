import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '../../generated/prisma/enums.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * RBAC guard — JwtAuthGuard ke BAAD chalta hai (tab tak request.user set ho chuka hota hai).
 * 401 Unauthorized = "tum kaun ho pata nahi" (login nahi)
 * 403 Forbidden    = "pata hai tum kaun ho, par permission nahi"
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      StaffRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) return false; // public route pe @Roles — galat config

    if (user.role === 'SUPER_ADMIN' || requiredRoles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException('You do not have permission for this action');
  }
}
