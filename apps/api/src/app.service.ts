import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`; // sabse chhoti query — DB zinda hai?
    } catch {
      database = 'down';
    }
    return { status: 'ok', service: 'calling-crm-api', database };
  }
}
