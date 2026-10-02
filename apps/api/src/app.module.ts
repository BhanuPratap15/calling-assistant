import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    // .env load karta hai. Root .env (local dev) — CI/production me real env variables use hote hain.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env'] }),
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
