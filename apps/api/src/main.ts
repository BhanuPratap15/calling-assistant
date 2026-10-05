import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { requestLogger } from './common/request-logger.js';

async function bootstrap() {
  // rawBody: webhook signature raw bytes pe check hoti hai (Phase 7)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    // Production: LOG_FORMAT=json → har log line ek JSON (log tools / docker logs me search aasaan)
    logger:
      process.env.LOG_FORMAT === 'json'
        ? new ConsoleLogger({ json: true, colors: false })
        : undefined,
  });
  // Nginx (reverse proxy) ke peeche: TRUST_PROXY=1 → req.ip = asli client IP (X-Forwarded-For se)
  // Bina proxy ke ise set MAT karo — warna koi bhi fake header bhej ke rate limit bypass kar dega
  if (process.env.TRUST_PROXY)
    app.set(
      'trust proxy',
      Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY,
    );
  configureApp(app);
  // Har request ki log line (tests me nahi — isliye configureApp ke bahar)
  if (process.env.LOG_REQUESTS !== 'false')
    app.use(requestLogger(new Logger('HTTP')));

  // Frontend (Next.js, port 3000) ko is API ko call karne ki permission
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
await bootstrap();
