import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CallingWatchdogService } from '../calling/calling-watchdog.service.js';
import { FollowUpSchedulerService } from '../follow-ups/follow-up-scheduler.service.js';
import { FOLLOW_UP_QUEUE } from './scheduler.constants.js';

/**
 * BullMQ Worker: queue se job aaya → follow-up tick() + calling watchdog tick() chalao.
 * Kai API servers ho to bhi ek job ek hi worker uthata hai (Redis lock).
 */
@Processor(FOLLOW_UP_QUEUE)
export class FollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpProcessor.name);

  constructor(
    private readonly scheduler: FollowUpSchedulerService,
    private readonly watchdog: CallingWatchdogService,
  ) {
    super();
  }

  async process(job: Job) {
    try {
      const now = new Date();
      const followUps = await this.scheduler.tick(now);
      const calling = await this.watchdog.tick(now);
      return { ...followUps, ...calling };
    } catch (error) {
      this.logger.error(`tick failed (job ${job.id})`, error as Error);
      throw error; // BullMQ job "failed" mark karega; agla tick phir try karega
    }
  }
}
