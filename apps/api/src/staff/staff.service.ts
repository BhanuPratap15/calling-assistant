import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.staff.findMany({
      // select = sirf ye columns. passwordHash KABHI API response me nahi jaana chahiye.
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        availability: true,
        isActive: true,
        teamId: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
