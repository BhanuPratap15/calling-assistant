import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { tenantExtension } from '../tenancy/tenant-extension.js';

/**
 * Poore app ka ek hi database connection (PrismaClient).
 * Kisi bhi service me constructor se inject karo:
 *   constructor(private readonly prisma: PrismaService) {}
 *   this.prisma.staff.findMany()
 *
 * Multi-tenant: client "tenant extension" ke saath aata hai — har tenant table ki query
 * me current organization ka filter automatically lagta hai (tenancy/tenant-extension.ts).
 * Raw SQL ($queryRaw) me filter khud lagao: currentOrgId().
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    // Prisma 7: "driver adapter" se Postgres se connect hota hai (node-postgres / pg)
    const adapter = new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
    super({ adapter });
    // Extended client hi inject hota hai (type wahi rehta hai — query API same)
    const extended = this.$extends(tenantExtension);
    // Nest lifecycle hook extended object pe bhi mile
    Object.defineProperty(extended, 'onModuleDestroy', {
      value: () => this.$disconnect(),
    });
    return extended as unknown as PrismaService;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
