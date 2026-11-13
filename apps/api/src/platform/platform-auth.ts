import {
  BadRequestException,
  type CanActivate,
  ConflictException,
  createParamDecorator,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { authCookieOptions, type JwtPayload } from '../auth/auth.types.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginLimiter } from '../security/login-limiter.js';
import { PlatformAuditService } from './platform-audit.service.js';
import { PLATFORM_COOKIE, PlatformAction } from './platform.constants.js';

const DUMMY_HASH =
  '$2b$12$wigvdTAO5c1vD6LtS6B.p.N3NyiPyINo39Ox0foBdFWsPx6uHUahK';

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
}

type PlatformRequest = Request & { platformUser?: PlatformUser };

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformUser =>
    ctx.switchToHttp().getRequest<PlatformRequest>().platformUser!,
);

export const platformCookieOptions = authCookieOptions;

/** Platform panel ke routes: platform admin ka token (cookie / Bearer) zaroori */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PlatformRequest>();
    const [type, bearer] = req.headers.authorization?.split(' ') ?? [];
    const token =
      (type === 'Bearer' ? bearer : undefined) ??
      (req.cookies as Record<string, string> | undefined)?.[PLATFORM_COOKIE];
    if (!token) throw new UnauthorizedException('Please log in');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired — please log in again');
    }
    if (payload.typ !== 'platform')
      throw new UnauthorizedException('Platform login required');
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive || admin.tokenVersion !== payload.ver)
      throw new UnauthorizedException('Session expired — please log in again');
    req.platformUser = { id: admin.id, name: admin.name, email: admin.email };
    return true;
  }
}

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly limiter: LoginLimiter,
    private readonly audit: PlatformAuditService,
  ) {}

  async login(email: string, password: string, ip = 'unknown') {
    const normalized = email.trim().toLowerCase();
    const key = `platform:${normalized}`;
    const wait =
      this.limiter.retryAfterMs(ip, key) ??
      this.limiter.retryAfterMs(ip, '*', 'ip');
    if (wait !== null)
      throw new HttpException(
        `Too many failed login attempts. Try again in ${Math.ceil(wait / 60_000)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: normalized },
    });
    const ok = await verifyPassword(
      password,
      admin?.passwordHash ?? DUMMY_HASH,
    );
    if (!admin || !ok || !admin.isActive) {
      this.limiter.fail(ip, key);
      this.limiter.fail(ip, '*', 'ip');
      await this.audit.record({
        actorId: null,
        action: PlatformAction.LOGIN_FAILED,
        metadata: { email: normalized, ip },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    this.limiter.succeed(ip, key);
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      actorId: admin.id,
      action: PlatformAction.LOGIN,
      metadata: { ip },
    });
    return {
      ...(await this.issueToken(admin)),
      user: { id: admin.id, name: admin.name, email: admin.email },
    };
  }

  async issueToken(admin: { id: string; tokenVersion: number }) {
    const accessToken = await this.jwt.signAsync({
      sub: admin.id,
      role: 'SUPER_ADMIN', // JwtPayload shape; platform guard sirf `typ` dekhta hai
      ver: admin.tokenVersion,
      typ: 'platform',
    } satisfies JwtPayload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
    return { accessToken, expiresAt: new Date(exp * 1000).toISOString() };
  }

  setCookie(res: Response, token: { accessToken: string; expiresAt: string }) {
    res.cookie(PLATFORM_COOKIE, token.accessToken, {
      ...platformCookieOptions(),
      expires: new Date(token.expiresAt),
    });
  }

  async logout(token: string | undefined) {
    if (!token) return;
    try {
      const { sub, ver, typ } = await this.jwt.verifyAsync<JwtPayload>(token);
      if (typ !== 'platform') return;
      await this.prisma.platformAdmin.updateMany({
        where: { id: sub, tokenVersion: ver },
        data: { tokenVersion: { increment: 1 } },
      });
    } catch {
      // expired — cookie phir bhi clear
    }
  }

  async changePassword(id: string, current: string, next: string) {
    const admin = await this.prisma.platformAdmin.findUniqueOrThrow({
      where: { id },
    });
    if (!(await verifyPassword(current, admin.passwordHash)))
      throw new UnauthorizedException('Current password is incorrect');
    if (current === next)
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    const updated = await this.prisma.platformAdmin.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(next),
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.record({
      actorId: id,
      action: PlatformAction.PASSWORD_CHANGED,
    });
    return this.issueToken(updated);
  }

  // ---------- platform admins (team) ----------

  listAdmins() {
    return this.prisma.platformAdmin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async createAdmin(
    actor: PlatformUser,
    dto: { name: string; email: string; password: string },
  ) {
    const admin = await withUniqueConflict(
      async () =>
        this.prisma.platformAdmin.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash: await hashPassword(dto.password),
          },
          select: { id: true, name: true, email: true, isActive: true },
        }),
      'A platform admin with this email already exists',
    );
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.ADMIN_CREATED,
      metadata: { adminId: admin.id, email: admin.email },
    });
    return admin;
  }

  async setAdminActive(actor: PlatformUser, id: string, isActive: boolean) {
    if (id === actor.id && !isActive)
      throw new ConflictException('You cannot deactivate yourself');
    const admin = await this.prisma.platformAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Platform admin not found');
    const updated = await this.prisma.platformAdmin.update({
      where: { id },
      data: { isActive, tokenVersion: { increment: isActive ? 0 : 1 } },
      select: { id: true, name: true, email: true, isActive: true },
    });
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.ADMIN_UPDATED,
      changes: { isActive: { from: admin.isActive, to: isActive } },
      metadata: { adminId: id },
    });
    return updated;
  }
}
