/**
 * Seed = database me shuruaati zaroori data daalna.
 * Abhi: pehla SUPER_ADMIN (bina iske koi login hi nahi kar payega).
 *
 * Chalao:  npm run db:seed
 * Safe to re-run: agar admin already hai to kuch nahi badalta (password bhi nahi).
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';

config({ path: '../../.env', quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing env variable: ${name} (dekho .env.example)`);
  return value;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  const email = requireEnv('SEED_ADMIN_EMAIL').trim().toLowerCase();
  const password = requireEnv('SEED_ADMIN_PASSWORD');
  if (password.length < 8) {
    throw new Error(
      'SEED_ADMIN_PASSWORD kam se kam 8 characters ka hona chahiye',
    );
  }

  try {
    const admin = await prisma.staff.upsert({
      where: { email },
      update: {}, // already hai → kuch mat badlo
      create: {
        name: process.env.SEED_ADMIN_NAME ?? 'Super Admin',
        email,
        passwordHash: await hashPassword(password),
        role: 'SUPER_ADMIN',
        // .env wala password sabko pata hota hai → pehle login pe badalna zaroori
        mustChangePassword: true,
      },
    });
    console.log(`✔ Super Admin ready: ${admin.email} (id: ${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
