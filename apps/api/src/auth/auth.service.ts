import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginLimiter } from '../security/login-limiter.js';
import type { Availability } from '../generated/prisma/enums.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

// Email na mile tab bhi bcrypt compare chalao — warna response time se attacker
// pata laga sakta hai ki kaunsa email exist karta hai ("timing attack").
const DUMMY_HASH =
  '$2b$12$wigvdTAO5c1vD6LtS6B.p.N3NyiPyINo39Ox0foBdFWsPx6uHUahK';

/** Inke liye availability matter karti hai (calls / follow-ups lete hain) */
const CALLING_ROLES: string[] = ['ASSISTANT', 'TEAM_LEADER'];

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly limiter: LoginLimiter,
  ) {}

  // Password spraying (ek IP se bahut saare emails try) — IP level limit, email "*"
  private ipWait(ip: string) {
    return this.limiter.retryAfterMs(ip, '*', 'ip');
  }

  async login(
    email: string,
    password: string,
    ip = 'unknown',
  ): Promise<{
    accessToken: string;
    expiresAt: string;
    user: AuthUser & { mustChangePassword: boolean };
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    // Brute-force: is IP + email pe bahut galat try → kuch der ke liye band (password check bhi nahi)
    const wait =
      this.limiter.retryAfterMs(ip, normalizedEmail) ?? this.ipWait(ip);
    if (wait !== null) {
      throw new HttpException(
        `Too many failed login attempts. Try again in ${Math.ceil(wait / 60_000)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const staff = await this.prisma.staff.findUnique({
      where: { email: normalizedEmail },
    });

    const passwordOk = await verifyPassword(
      password,
      staff?.passwordHash ?? DUMMY_HASH,
    );
    // Ek hi generic message — "email galat" ya "password galat" alag se nahi batate
    if (!staff || !passwordOk || !staff.isActive) {
      this.limiter.fail(ip, normalizedEmail);
      this.limiter.fail(ip, '*', 'ip');
      // Failed login bhi record — brute-force / galat access attempts pakadne ke liye
      await this.audit.record({
        actorId: null,
        action: AuditAction.AUTH_LOGIN_FAILED,
        entityType: 'auth',
        entityId: staff?.id ?? null,
        metadata: {
          email: normalizedEmail,
          reason: !staff
            ? 'unknown_email'
            : !passwordOk
              ? 'wrong_password'
              : 'inactive',
          ip,
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    this.limiter.succeed(ip, normalizedEmail);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.staff.update({
        where: { id: staff.id },
        data: { lastLoginAt: now, lastSeenAt: now },
      });
      // Calling staff login = kaam pe aa gaya → AVAILABLE (design doc 8.2)
      if (
        CALLING_ROLES.includes(staff.role) &&
        staff.availability === 'OFFLINE'
      ) {
        await this.changeAvailability(
          staff.id,
          'OFFLINE',
          'AVAILABLE',
          'login',
          tx,
        );
      }
      await this.audit.record(
        {
          actorId: staff.id,
          action: AuditAction.AUTH_LOGIN,
          entityType: 'auth',
          entityId: staff.id,
        },
        tx,
      );
    });

    return {
      ...(await this.issueToken(staff)),
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        mustChangePassword: staff.mustChangePassword,
      },
    };
  }

  /** Naya token (staff ke current tokenVersion ke saath) */
  async issueToken(staff: {
    id: string;
    role: AuthUser['role'];
    tokenVersion: number;
  }) {
    const payload: JwtPayload = {
      sub: staff.id,
      role: staff.role,
      ver: staff.tokenVersion,
    };
    const accessToken = await this.jwt.signAsync(payload);
    // Token kab expire hoga (JWT ke andar "exp" = seconds) — cookie bhi tab tak
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
    return { accessToken, expiresAt: new Date(exp * 1000).toISOString() };
  }

  /**
   * Logged-in staff apna password khud badle (purana password zaroori).
   * Saare purane sessions (doosre browser / chura hua token) bekaar → is browser ke liye naya token.
   */
  async changePassword(
    staffId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
    });
    if (!(await verifyPassword(currentPassword, staff.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }
    const passwordHash = await hashPassword(newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id: staffId },
        data: {
          passwordHash,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
      });
      await this.audit.record(
        {
          actorId: staffId,
          action: AuditAction.AUTH_PASSWORD_CHANGED,
          entityType: 'auth',
          entityId: staffId,
        },
        tx,
      );
      return updated;
    });
    return this.issueToken(updated);
  }

  /** /auth/me — user + availability (header ka status dropdown) */
  async me(user: AuthUser) {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: user.id },
      select: { availability: true, mustChangePassword: true },
    });
    return {
      ...user,
      availability: staff.availability,
      mustChangePassword: staff.mustChangePassword,
    };
  }

  /** Assistant khud: AVAILABLE / BREAK / OFFLINE (ON_CALL system set karta hai) */
  async setAvailability(staffId: string, availability: Availability) {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
    });
    if (staff.availability !== availability) {
      await this.prisma.$transaction((tx) =>
        this.changeAvailability(
          staffId,
          staff.availability,
          availability,
          'manual',
          tx,
        ),
      );
    }
    return { availability };
  }

  /**
   * Logout → token revoke (tokenVersion++) + OFFLINE.
   * JWT khud "cancel" nahi hota — version badalne se guard purana token reject karta hai.
   * Token invalid / expired ho to kuch mat karo (cookie phir bhi clear hoti hai).
   */
  async logout(token: string | undefined) {
    if (!token) return;
    try {
      const { sub, ver } = await this.jwt.verifyAsync<JwtPayload>(token);
      // Sirf current version wala token hi revoke kar sake (purana chura token se baar-baar logout nahi)
      await this.prisma.staff.updateMany({
        where: { id: sub, tokenVersion: ver ?? 0 },
        data: { tokenVersion: { increment: 1 } },
      });
      const staff = await this.prisma.staff.findUnique({ where: { id: sub } });
      if (staff && staff.availability !== 'OFFLINE') {
        await this.prisma.$transaction((tx) =>
          this.changeAvailability(
            sub,
            staff.availability,
            'OFFLINE',
            'logout',
            tx,
          ),
        );
      }
    } catch {
      // expired / galat token — logout phir bhi ho jaayega (cookie clear)
    }
  }

  private async changeAvailability(
    staffId: string,
    from: Availability,
    to: Availability,
    reason: 'manual' | 'login' | 'logout',
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
  ) {
    await tx.staff.update({
      where: { id: staffId },
      data: { availability: to },
    });
    await this.audit.record(
      {
        actorId: staffId,
        action: AuditAction.STAFF_AVAILABILITY_CHANGED,
        entityType: 'staff',
        entityId: staffId,
        changes: { availability: { from, to } },
        metadata: { reason },
      },
      tx,
    );
  }
}
