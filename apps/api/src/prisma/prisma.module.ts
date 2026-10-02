import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// @Global: har module me PrismaService bina import kiye milega
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
