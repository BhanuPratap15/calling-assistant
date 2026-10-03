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

export type Availability = 'AVAILABLE' | 'ON_CALL' | 'BREAK' | 'OFFLINE';
export type CustomerStatus = 'ACTIVE' | 'DO_NOT_CALL' | 'INVALID';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const ALL_ROLES: StaffRole[] = [
  'SUPER_ADMIN',
  'MANAGER',
  'TEAM_LEADER',
  'ASSISTANT',
];
export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'ACTIVE',
  'DO_NOT_CALL',
  'INVALID',
];
export const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  availability: Availability;
  isActive: boolean;
  teamId: string | null;
  team: { id: string; name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  leader: { id: string; name: string; email: string } | null;
  _count: { members: number };
  createdAt: string;
}

export interface TeamDetail extends Team {
  members: Pick<
    Staff,
    'id' | 'name' | 'email' | 'role' | 'availability' | 'isActive'
  >[];
}

export interface Customer {
  id: string;
  externalId: string | null;
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  status: CustomerStatus;
  priority: Priority;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; role: StaffRole } | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
