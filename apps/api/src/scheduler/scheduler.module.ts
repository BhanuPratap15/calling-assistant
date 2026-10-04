import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { redisConnection } from '../common/redis.js';
import { FollowUpsModule } from '../follow-ups/follow-ups.module.js';
import { FollowUpProcessor } from './follow-up.processor.js';
import {
  FOLLOW_UP_QUEUE,
  FOLLOW_UP_TICK_SCHEDULER,
  TICK_EVERY_MS,
} from './scheduler.constants.js';

/**
 * Background jobs (Redis + BullMQ).
 * "Job scheduler" = repeatable job: Redis me ek hi schedule rehta hai, chahe kitne servers hon.
 * Tests me SCHEDULER_ENABLED=false → ye module load hi nahi hota (tests tick() khud chalate hain).
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(
          config.get('REDIS_URL', 'redis://localhost:6379'),
        ),
      }),
    }),
    BullModule.registerQueue({
      name: FOLLOW_UP_QUEUE,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 }, // Redis me history limited
    }),
    FollowUpsModule,
  ],
  providers: [FollowUpProcessor],
  exports: [BullModule], // health check queue ko dekh sake
})
export class SchedulerModule implements OnModuleInit {
  private readonly logger = new Logger(SchedulerModule.name);

  constructor(@InjectQueue(FOLLOW_UP_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // upsert = hai to update, nahi to banao (restart pe duplicate schedule nahi)
    await this.queue.upsertJobScheduler(
      FOLLOW_UP_TICK_SCHEDULER,
      { every: TICK_EVERY_MS },
      { name: 'tick' },
    );
    this.logger.log(`Follow-up scheduler: tick every ${TICK_EVERY_MS / 1000}s`);
  }
}
