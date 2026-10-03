import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { FollowUpSchedulerService } from '../follow-ups/follow-up-scheduler.service.js';
import { FOLLOW_UP_QUEUE } from './scheduler.constants.js';

/**
 * BullMQ Worker: queue se job aaya → tick() chalao.
 * Kai API servers ho to bhi ek job ek hi worker uthata hai (Redis lock).
 */
@Processor(FOLLOW_UP_QUEUE)
export class FollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpProcessor.name);

  constructor(private readonly scheduler: FollowUpSchedulerService) {
    super();
  }

  async process(job: Job) {
    try {
      return await this.scheduler.tick(new Date());
    } catch (error) {
      this.logger.error(`tick failed (job ${job.id})`, error as Error);
      throw error; // BullMQ job "failed" mark karega; agla tick phir try karega
    }
  }
}
