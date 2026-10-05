import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AUTH_COOKIE,
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
 * 5. request.user set karo
 */
const HEARTBEAT_INTERVAL_MS = 60_000;

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
    const token =
      this.extractBearerToken(request) ??
      (request.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
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
