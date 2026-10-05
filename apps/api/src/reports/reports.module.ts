import { Module } from '@nestjs/common';
import { CallConfigModule } from '../call-config/call-config.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [CallConfigModule], // follow-up grace period (on-time / overdue)
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
