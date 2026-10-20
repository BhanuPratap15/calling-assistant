import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AUTH_COOKIE,
  authCookieOptions,
  type AuthenticatedRequest,
  type JwtPayload,
} from '../auth.types.js';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard = darwaaze ka guard. Har request pe chalta hai (global, app.module me register).
 * 1. @Public() route → seedha jaane do
 * 2. Token nikalo — header "Authorization: Bearer <token>" (api.http, mobile)
 *    YA httpOnly cookie "access_token" (browser / Next.js frontend) — phir verify karo
 * 3. DB se staff check karo (deactivate hua staff turant block ho jaaye) + token version
 *    (logout / password change ke baad purana token kaam nahi karta)
 *    + mustChangePassword (manager ka diya password → pehle khud badlo)
 * 4. lastSeenAt heartbeat update (presence — follow-up escalation isi se decide hota hai)
 * 5. Sliding session: browser cookie wala token purana ho gaya → naya token + cookie
 *    (warna login ke 8h baad kaam karte-karte cookie expire → "Missing access token")
 * 6. request.user set karo
 */
const HEARTBEAT_INTERVAL_MS = 60_000;
/** Cookie token itna purana ho to har request pe naya de do (max 1 baar / 10 min) */
const TOKEN_RENEW_AFTER_MS = 10 * 60_000;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = this.extractBearerToken(request);
    const token =
      bearer ??
      (request.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) {
      throw new UnauthorizedException(
        'Your session has expired — please log in again',
      );
    }

    let payload: JwtPayload & { iat?: number };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { iat?: number }>(
        token,
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastSeenAt: true,
        tokenVersion: true,
        mustChangePassword: true,
      },
    });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Account not found or deactivated');
    }
    // Logout / password change ke baad version badal jaata hai → chura hua purana token bekaar
    if ((payload.ver ?? 0) !== staff.tokenVersion) {
      throw new UnauthorizedException('Session expired — please log in again');
    }
    if (
      staff.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      throw new ForbiddenException('Password change required');
    }

    // Heartbeat: "ye banda abhi online hai" — har request pe nahi, max 1 baar / minute (DB load kam)
    const now = Date.now();
    if (
      !staff.lastSeenAt ||
      now - staff.lastSeenAt.getTime() > HEARTBEAT_INTERVAL_MS
    ) {
      await this.prisma.staff.update({
        where: { id: staff.id },
        data: { lastSeenAt: new Date(now) },
      });
    }

    // Sirf browser (cookie) session renew — Bearer token wale (api.http / mobile) khud login karein
    if (
      !bearer &&
      (!payload.iat || now - payload.iat * 1000 > TOKEN_RENEW_AFTER_MS)
    ) {
      const fresh = await this.jwt.signAsync({
        sub: staff.id,
        role: staff.role,
        ver: staff.tokenVersion,
      } satisfies JwtPayload);
      const { exp } = this.jwt.decode<{ exp: number }>(fresh);
      context
        .switchToHttp()
        .getResponse<Response>()
        .cookie(AUTH_COOKIE, fresh, {
          ...authCookieOptions(),
          expires: new Date(exp * 1000),
        });
    }

    request.user = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role, // role hamesha DB se — token purana ho tab bhi latest role
    };
    return true;
  }

  private extractBearerToken(
    request: AuthenticatedRequest,
  ): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
