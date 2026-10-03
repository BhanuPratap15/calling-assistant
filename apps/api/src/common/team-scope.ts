import type { AuthUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * "Ye user kin staff ka data dekh/badal sakta hai?"
 *   TEAM_LEADER → khud + jin teams ka leader hai unke members (IDs)
 *   MANAGER / SUPER_ADMIN → null (matlab: sab)
 *   ASSISTANT → sirf khud
 */
export async function staffScope(
  prisma: PrismaService,
  actor: AuthUser,
): Promise<string[] | null> {
  if (actor.role === 'ASSISTANT') return [actor.id];
  if (actor.role !== 'TEAM_LEADER') return null;
  const members = await prisma.staff.findMany({
    where: { team: { leaderId: actor.id } },
    select: { id: true },
  });
  return [actor.id, ...members.map((m) => m.id)];
}
