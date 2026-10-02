import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Saare API routes /api se shuru honge, e.g. GET /api/health
  app.setGlobalPrefix('api');

  // Frontend (Next.js, port 3000) ko is API ko call karne ki permission
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
await bootstrap();
