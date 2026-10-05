import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // rawBody: webhook signature raw bytes pe check hoti hai (Phase 7)
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);

  // Frontend (Next.js, port 3000) ko is API ko call karne ki permission
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' });

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
await bootstrap();
