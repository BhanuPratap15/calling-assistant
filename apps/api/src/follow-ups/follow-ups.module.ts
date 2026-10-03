import { Module } from '@nestjs/common';
import { CallConfigModule } from '../call-config/call-config.module.js';
import { FollowUpSchedulerService } from './follow-up-scheduler.service.js';
import { FollowUpsController } from './follow-ups.controller.js';
import { FollowUpsService } from './follow-ups.service.js';

@Module({
  imports: [CallConfigModule], // timing settings
  controllers: [FollowUpsController],
  providers: [FollowUpsService, FollowUpSchedulerService],
  exports: [FollowUpsService, FollowUpSchedulerService],
})
export class FollowUpsModule {}
