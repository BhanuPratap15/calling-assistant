import type { CookieOptions, Request } from 'express';
import type { StaffRole } from '../generated/prisma/enums.js';

/** JWT token ke andar kya store hota hai (token decode karke koi bhi padh sakta hai — secret mat daalo) */
export interface JwtPayload {
  sub: string; // staff id ("subject" — JWT standard naam)
  role: StaffRole;
  ver: number; // staff.tokenVersion — badla (logout / password change) → ye token bekaar
}

/** Login hua staff — guard isko request.user me daalta hai */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Browser login cookie ka naam (httpOnly — JavaScript isse padh nahi sakti) */
export const AUTH_COOKIE = 'access_token';

/**
 * Cookie settings:
 *  httpOnly  → browser ki JavaScript cookie padh nahi sakti (XSS se token chori nahi)
 *  sameSite  → doosri website se aayi request ke saath cookie nahi jaati (CSRF se bachav)
 *  secure    → sirf HTTPS pe (production default). COOKIE_SECURE=false sirf HTTP pe testing ke liye.
 */
export const authCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',
  path: '/',
});
