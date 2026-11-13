import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CallingWatchdogService } from '../calling/calling-watchdog.service.js';
import { FollowUpSchedulerService } from '../follow-ups/follow-up-scheduler.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { runInOrg } from '../tenancy/tenant-context.js';
import { FOLLOW_UP_QUEUE } from './scheduler.constants.js';

/**
 * BullMQ Worker: queue se job aaya → follow-up tick() + calling watchdog tick() chalao.
 * Kai API servers ho to bhi ek job ek hi worker uthata hai (Redis lock).
 * Multi-tenant: har ACTIVE client ke liye alag (uske settings + uska data). Ek client me error
 * baaki clients ko nahi rokta.
 */
@Processor(FOLLOW_UP_QUEUE)
export class FollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpProcessor.name);

  constructor(
    private readonly scheduler: FollowUpSchedulerService,
    private readonly watchdog: CallingWatchdogService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job) {
    const now = new Date();
    const orgs = await this.prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, slug: true },
    });
    const totals: Record<string, number> = {};
    let failed = 0;
    for (const org of orgs) {
      try {
        const result = await runInOrg(org.id, async () => ({
          ...(await this.scheduler.tick(now)),
          ...(await this.watchdog.tick(now)),
        }));
        for (const [k, v] of Object.entries(result))
          totals[k] = (totals[k] ?? 0) + v;
      } catch (error) {
        failed++;
        this.logger.error(
          `tick failed for ${org.slug} (job ${job.id})`,
          error as Error,
        );
      }
    }
    // Sab fail → BullMQ job "failed" (monitoring dekhe); agla tick phir try karega
    if (failed && failed === orgs.length) throw new Error('tick failed');
    return totals;
  }
}
