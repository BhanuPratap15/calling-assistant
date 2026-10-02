import type { Request } from 'express';
import type { StaffRole } from '../generated/prisma/enums.js';

/** JWT token ke andar kya store hota hai (token decode karke koi bhi padh sakta hai — secret mat daalo) */
export interface JwtPayload {
  sub: string; // staff id ("subject" — JWT standard naam)
  role: StaffRole;
}

/** Login hua staff — guard isko request.user me daalta hai */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };
