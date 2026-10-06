import { Module } from '@nestjs/common';
import { CallConfigModule } from '../call-config/call-config.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { FollowUpsModule } from '../follow-ups/follow-ups.module.js';
import { TelephonyModule } from '../telephony/telephony.module.js';
import { CallingController } from './calling.controller.js';
import { CallingService } from './calling.service.js';
import { CallingWatchdogService } from './calling-watchdog.service.js';

@Module({
  imports: [
    CallConfigModule,
    FollowUpsModule,
    CategoriesModule,
    TelephonyModule,
  ], // rules, follow-ups, categories, dial
  controllers: [CallingController],
  providers: [CallingService, CallingWatchdogService],
  exports: [CallingWatchdogService], // scheduler har tick pe chalata hai
})
export class CallingModule {}
