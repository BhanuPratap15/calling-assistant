import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { LoginLimiter } from '../security/login-limiter.js';
import { OrganizationsService } from './organizations.service.js';
import { PlatformAuthGuard, PlatformAuthService } from './platform-auth.js';
import { PlatformAuditService } from './platform-audit.service.js';
import {
  DomainSyncController,
  PlatformAuthController,
  PlatformController,
} from './platform.controller.js';

/**
 * White-label / SaaS platform: clients (organizations) banana, branding, theme, domains,
 * dialer, client admins. UI: web /platform. Login: platform_admins table (seed se pehla).
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'PLATFORM_JWT_EXPIRES_IN',
            '12h',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [
    PlatformAuthController,
    PlatformController,
    DomainSyncController,
  ],
  providers: [
    OrganizationsService,
    PlatformAuthService,
    PlatformAuthGuard,
    PlatformAuditService,
    {
      provide: LoginLimiter,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new LoginLimiter(
          Number(config.get('LOGIN_MAX_FAILURES', 5)),
          Number(config.get('LOGIN_LOCK_MINUTES', 15)) * 60_000,
        ),
    },
  ],
  exports: [OrganizationsService],
})
export class PlatformModule {}
