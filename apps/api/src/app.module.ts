import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CallConfigModule } from './call-config/call-config.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StaffModule } from './staff/staff.module.js';
import { TeamsModule } from './teams/teams.module.js';

@Module({
  imports: [
    // .env load karta hai. Root .env (local dev) — CI/production me real env variables use hote hain.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'] }),
    PrismaModule,
    AuditModule,
    AuthModule,
    StaffModule,
    TeamsModule,
    CustomersModule,
    CallConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
