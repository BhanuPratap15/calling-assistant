import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Poore app ka ek hi database connection (PrismaClient).
 * Kisi bhi service me constructor se inject karo:
 *   constructor(private readonly prisma: PrismaService) {}
 *   this.prisma.staff.findMany()
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    // Prisma 7: "driver adapter" se Postgres se connect hota hai (node-postgres / pg)
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    super({ adapter });
  }

  // App start hote hi DB connect — DB down ho to turant pata chale
  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  // App band ho to connection cleanly close
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
