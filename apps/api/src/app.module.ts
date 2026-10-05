import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CallConfigModule } from './call-config/call-config.module.js';
import { CallingModule } from './calling/calling.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { FollowUpsModule } from './follow-ups/follow-ups.module.js';
import { ImportsModule } from './imports/imports.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { StaffModule } from './staff/staff.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { TelephonyModule } from './telephony/telephony.module.js';
import { TagsModule } from './tags/tags.module.js';
import { TeamsModule } from './teams/teams.module.js';

@Module({
  imports: [
    // .env load karta hai. Root .env (local dev) — CI/production me real env variables use hote hain.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'] }),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    StaffModule,
    TeamsModule,
    CustomersModule,
    CallConfigModule,
    CallingModule,
    AssignmentsModule,
    FollowUpsModule,
    CategoriesModule,
    TagsModule,
    CampaignsModule,
    ImportsModule,
    TelephonyModule,
    ReportsModule,
    // Background jobs (Redis). ConfigModule upar .env load kar chuka hai, isliye process.env yahan ready hai.
    // Tests: SCHEDULER_ENABLED=false (vitest config) → Redis ki zaroorat nahi.
    ...(process.env.SCHEDULER_ENABLED === 'false' ? [] : [SchedulerModule]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
