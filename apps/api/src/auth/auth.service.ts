import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const staff = await this.prisma.staff.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    const passwordOk = await verifyPassword(
      password,
      staff?.passwordHash ?? DUMMY_HASH,
    );
    // Ek hi generic message — "email galat" ya "password galat" alag se nahi batate
    if (!staff || !passwordOk || !staff.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.staff.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = { sub: staff.id, role: staff.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
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
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  }
}
