import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

// Email na mile tab bhi bcrypt compare chalao — warna response time se attacker
// pata laga sakta hai ki kaunsa email exist karta hai ("timing attack").
const DUMMY_HASH =
  '$2b$12$wigvdTAO5c1vD6LtS6B.p.N3NyiPyINo39Ox0foBdFWsPx6uHUahK';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; expiresAt: string; user: AuthUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const staff = await this.prisma.staff.findUnique({
      where: { email: normalizedEmail },
    });

    const passwordOk = await verifyPassword(
      password,
      staff?.passwordHash ?? DUMMY_HASH,
    );
    // Ek hi generic message — "email galat" ya "password galat" alag se nahi batate
    if (!staff || !passwordOk || !staff.isActive) {
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
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date() },
      });
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

    const payload: JwtPayload = { sub: staff.id, role: staff.role };
    const accessToken = await this.jwt.signAsync(payload);
    // Token kab expire hoga (JWT ke andar "exp" = seconds) — cookie bhi tab tak
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
    return {
      accessToken,
      expiresAt: new Date(exp * 1000).toISOString(),
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
    };
  }

  /** Logged-in staff apna password khud badle (purana password zaroori) */
  async changePassword(
    staffId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
    });
    if (!(await verifyPassword(currentPassword, staff.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id: staffId }, data: { passwordHash } });
      await this.audit.record(
        {
          actorId: staffId,
          action: AuditAction.AUTH_PASSWORD_CHANGED,
          entityType: 'auth',
          entityId: staffId,
        },
        tx,
      );
    });
  }
}
