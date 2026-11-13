/**
 * Seed = database me shuruaati zaroori data daalna.
 *
 *  1. Platform admin (aap) — /platform panel ka login.
 *     PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD (/ PLATFORM_ADMIN_NAME)
 *  2. Default client (migration ne banaya, brand "Addaplay") ka pehla SUPER_ADMIN.
 *     SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (/ SEED_ADMIN_NAME)
 *
 * Dono optional (env na ho to skip). Chalao:  npm run db:seed
 * Safe to re-run: pehle se hai to kuch nahi badalta (password bhi nahi).
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';
import { DEFAULT_ORG_ID } from '../src/tenancy/tenant-context.js';

config({ path: '../../.env', quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing env variable: ${name} (dekho .env.example)`);
  return value;
}

function checkPassword(name: string, password: string) {
  if (password.length < 8)
    throw new Error(`${name} kam se kam 8 characters ka hona chahiye`);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  try {
    // 1. Platform admin
    const platformEmail =
      process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
    const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD;
    if (platformEmail && platformPassword) {
      checkPassword('PLATFORM_ADMIN_PASSWORD', platformPassword);
      const admin = await prisma.platformAdmin.upsert({
        where: { email: platformEmail },
        update: {},
        create: {
          name: process.env.PLATFORM_ADMIN_NAME ?? 'Platform Admin',
          email: platformEmail,
          passwordHash: await hashPassword(platformPassword),
        },
      });
      console.log(`✔ Platform admin ready: ${admin.email}`);
    } else {
      console.log(
        '· PLATFORM_ADMIN_EMAIL / PASSWORD not set — platform admin skipped',
      );
    }

    // 2. Default client ka Super Admin
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (email && password) {
      checkPassword('SEED_ADMIN_PASSWORD', password);
      const existing = await prisma.staff.findFirst({
        where: { email, organizationId: DEFAULT_ORG_ID },
      });
      const admin =
        existing ??
        (await prisma.staff.create({
          data: {
            organizationId: DEFAULT_ORG_ID,
            name: process.env.SEED_ADMIN_NAME ?? 'Super Admin',
            email,
            passwordHash: await hashPassword(password),
            role: 'SUPER_ADMIN',
            // .env wala password sabko pata hota hai → pehle login pe badalna zaroori
            mustChangePassword: true,
          },
        }));
      console.log(`✔ Super Admin ready: ${admin.email} (id: ${admin.id})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
