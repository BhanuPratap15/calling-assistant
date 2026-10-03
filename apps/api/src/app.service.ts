import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from './prisma/prisma.service.js';
import { FOLLOW_UP_QUEUE } from './scheduler/scheduler.constants.js';

type Status = 'up' | 'down';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    // @Optional: SCHEDULER_ENABLED=false (tests) me queue hoti hi nahi
    @Optional() @InjectQueue(FOLLOW_UP_QUEUE) private readonly queue?: Queue,
  ) {}

  async getHealth() {
    let database: Status = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`; // sabse chhoti query — DB zinda hai?
    } catch {
      database = 'down';
    }
    return {
      status: 'ok',
      service: 'calling-crm-api',
      database,
      scheduler: await this.schedulerStatus(),
    };
  }

  /** Redis tak pahunch + follow-up tick schedule registered hai? */
  private async schedulerStatus(): Promise<Status | 'disabled'> {
    if (!this.queue) return 'disabled';
    try {
      const schedulers = await this.queue.getJobSchedulers();
      return schedulers.length > 0 ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
