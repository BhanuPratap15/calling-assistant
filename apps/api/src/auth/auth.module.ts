import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  JwtModule,
  type JwtModuleOptions,
  type JwtSignOptions,
} from '@nestjs/jwt';
import { LoginLimiter } from '../security/login-limiter.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Token kitni der valid rahe (default 8h = ek shift)
          expiresIn: config.get<string>(
            'JWT_EXPIRES_IN',
            '8h',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Brute-force limit: LOGIN_MAX_FAILURES (default 5) galat try / LOGIN_LOCK_MINUTES (15) per IP + email
    {
      provide: LoginLimiter,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new LoginLimiter(
          Number(config.get('LOGIN_MAX_FAILURES', 5)),
          Number(config.get('LOGIN_LOCK_MINUTES', 15)) * 60_000,
          Date.now,
          Number(config.get('LOGIN_MAX_FAILURES_PER_IP', 30)),
        ),
    },
    // APP_GUARD = global guard, har route pe automatically. Order matters: pehle login check, phir role.
    // Pehle rate limit (flood login check tak hi na pahunche), phir login, phir role
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
