import type { StaffRole } from '../generated/prisma/enums.js';

/**
 * Kaun kisko manage (create / edit / password reset) kar sakta hai:
 *   SUPER_ADMIN → sabko
 *   MANAGER     → sirf TEAM_LEADER aur ASSISTANT
 *   baaki       → kisi ko nahi
 * Isse Manager khud ko ya kisi ko SUPER_ADMIN nahi bana sakta ("privilege escalation" se bachav).
 */
const MANAGEABLE_ROLES: Record<StaffRole, readonly StaffRole[]> = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'MANAGER', 'TEAM_LEADER', 'ASSISTANT'],
  MANAGER: ['TEAM_LEADER', 'ASSISTANT'],
  TEAM_LEADER: [],
  ASSISTANT: [],
};

export function canManageRole(actor: StaffRole, target: StaffRole): boolean {
  return MANAGEABLE_ROLES[actor].includes(target);
}
