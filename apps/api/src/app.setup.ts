import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * App-level settings ek jagah — main.ts aur e2e tests dono yahi use karte hain,
 * taaki test bilkul real app jaisa behave kare.
 */
export function configureApp(app: INestApplication): void {
  // Request ki cookies padh ke req.cookies me daalo (browser login cookie ke liye)
  app.use(cookieParser());

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
