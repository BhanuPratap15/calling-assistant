// Backend ke types ka frontend copy (aage chal ke shared package bana sakte hain)

export type StaffRole = 'SUPER_ADMIN' | 'MANAGER' | 'TEAM_LEADER' | 'ASSISTANT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  TEAM_LEADER: 'Team Leader',
  ASSISTANT: 'Calling Assistant',
};
