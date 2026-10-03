/**
 * Saare audit actions ek jagah — typo se galat action save na ho.
 * Naming: "<entity>.<kya hua>"
 */
export const AuditAction = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_PASSWORD_CHANGED: 'auth.password_changed',
  STAFF_CREATED: 'staff.created',
  STAFF_UPDATED: 'staff.updated',
  STAFF_PASSWORD_RESET: 'staff.password_reset',
  TEAM_CREATED: 'team.created',
  TEAM_UPDATED: 'team.updated',
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CALL_OUTCOME_CREATED: 'call_outcome.created',
  CALL_OUTCOME_UPDATED: 'call_outcome.updated',
  NEXT_ACTION_CREATED: 'next_action.created',
  NEXT_ACTION_UPDATED: 'next_action.updated',
  SETTING_UPDATED: 'setting.updated',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ENTITY_TYPES = [
  'auth',
  'staff',
  'team',
  'customer',
  'call_outcome',
  'next_action',
  'setting',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** { phone: { from: "+91...", to: "+91..." } } */
export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  changes?: AuditChanges;
  metadata?: Record<string, unknown>;
}
