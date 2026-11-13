/**
 * Emergency: admin ka password bhool gaye (aur koi doosra admin reset nahi kar sakta).
 * Staff → Reset password jaisa hi kaam: naya password + pehle login pe badalna zaroori
 * + purane saare sessions logout.
 *
 * Chalao (apps/api se):
 *   RESET_EMAIL=admin@example.com RESET_PASSWORD='NayaPass123!' npx tsx prisma/reset-admin-password.ts
 * Production DB ke liye DATABASE_URL bhi saath me do.
 * Multi-tenant: kis client ka staff — RESET_ORG_SLUG (default "default" = purana / pehla client).
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';

config({ path: '../../.env', quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  const email = requireEnv('RESET_EMAIL').trim().toLowerCase();
  const password = requireEnv('RESET_PASSWORD');
  if (password.length < 8) {
    throw new Error('RESET_PASSWORD kam se kam 8 characters ka hona chahiye');
  }

  try {
    const slug = process.env.RESET_ORG_SLUG?.trim() || 'default';
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new Error(`No organization with slug "${slug}"`);
    const staff = await prisma.staff.findFirst({
      where: { email, organizationId: org.id },
    });
    if (!staff) {
      const admins = await prisma.staff.findMany({
        where: { role: 'SUPER_ADMIN', organizationId: org.id },
        select: { email: true },
      });
      throw new Error(
        `No staff with email ${email}. SUPER_ADMINs: ${admins.map((a) => a.email).join(', ') || '(none)'}`,
      );
    }
    await prisma.staff.update({
      where: { id: staff.id },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        isActive: true,
        tokenVersion: { increment: 1 },
      },
    });
    console.log(`✔ Password reset: ${staff.email} (${staff.role})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
