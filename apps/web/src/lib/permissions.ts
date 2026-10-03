import type { StaffRole } from './types';

/**
 * Backend ke staff-permissions.ts ka copy — sirf UI ke liye (button dikhana/chhupana).
 * Asli rule backend enforce karta hai; dono ko sync rakho.
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

export function manageableRoles(actor: StaffRole): readonly StaffRole[] {
  return MANAGEABLE_ROLES[actor];
}

/** Manager-level (Manager ya Super Admin) */
export function isManager(role: StaffRole): boolean {
  return role === 'MANAGER' || role === 'SUPER_ADMIN';
}
