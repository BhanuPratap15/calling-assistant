import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { tenantMiddleware } from './tenancy/tenant.middleware.js';
import { TenantResolver } from './tenancy/tenant-resolver.service.js';

/**
 * App-level settings ek jagah — main.ts aur e2e tests dono yahi use karte hain,
 * taaki test bilkul real app jaisa behave kare.
 */
export function configureApp(app: INestApplication): void {
  // Security headers (X-Content-Type-Options, HSTS, frame block, X-Powered-By hatao...) — Phase 9
  app.use(helmet());

  // Request ki cookies padh ke req.cookies me daalo (browser login cookie ke liye)
  app.use(cookieParser());

  // Platform panel se logo / favicon (data URL) aate hain — JSON limit 100kb → 2mb
  (app as NestExpressApplication).useBodyParser('json', { limit: '2mb' });

  // Multi-tenant: Host → client; poori request us client ke context me (tenancy/)
  const platformHosts = (process.env.PLATFORM_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  app.use(tenantMiddleware(app.get(TenantResolver), platformHosts));

  // Saare API routes /api se shuru honge, e.g. GET /api/health
  app.setGlobalPrefix('api');

  // DTO validation har request pe:
  // whitelist = DTO me jo field nahi hai wo hata do; forbidNonWhitelisted = extra field aaye to 400
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
