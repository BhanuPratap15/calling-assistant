// Backend ke types ka frontend copy (aage chal ke shared package bana sakte hain)

export type StaffRole = 'SUPER_ADMIN' | 'MANAGER' | 'TEAM_LEADER' | 'ASSISTANT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  availability?: Availability; // /auth/me se (login response me nahi)
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
  assignments?: OpenAssignmentSummary[]; // list API: kiske paas hai
  lastCalledAt?: string | null;
  callCount?: number;
  interestRating?: number | null;
  category?: CategoryRef | null;
  tags?: { tag: TagRef }[];
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

// ---- Call form configuration (Step 2.1) ----
export type RequiredRule = 'always' | 'connected' | 'optional';

export interface CallOutcome {
  id: string;
  code: string;
  label: string;
  isConnected: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface NextAction {
  id: string;
  code: string;
  label: string;
  requiresFollowUp: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface RequiredFieldsConfig {
  userResponse: RequiredRule;
  notes: RequiredRule;
  interestRating: RequiredRule;
}

export interface CallConfig {
  outcomes: CallOutcome[];
  nextActions: NextAction[];
  requiredFields: RequiredFieldsConfig;
  followUpTiming: FollowUpTimingConfig;
}

// ---- Calling workflow (Phase 2) ----
export type AssignmentStatus =
  'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AssignmentSource = 'AUTO' | 'MANUAL' | 'FOLLOW_UP';

export interface CallRecord {
  id: string;
  createdAt: string;
  userResponse: string | null;
  notes: string | null;
  interestRating: number | null;
  followUpAt: string | null;
  outcome: { code: string; label: string; isConnected: boolean };
  nextAction: { code: string; label: string; requiresFollowUp: boolean };
  staff: { id: string; name: string };
}

export interface OpenAssignmentSummary {
  id: string;
  status: AssignmentStatus;
  source?: AssignmentSource;
  createdAt?: string;
  staff: { id: string; name: string };
}

export interface CustomerProfile extends Customer {
  lastCalledAt: string | null;
  callCount: number;
  assignments: OpenAssignmentSummary[];
  calls: CallRecord[];
  categoryChanges: CategoryChange[];
  tags: { tag: TagRef }[]; // profile me hamesha aate hain
  category: CategoryRef | null;
  interestRating: number | null;
}

export interface CurrentAssignment {
  id: string;
  source: AssignmentSource;
  startedAt: string | null;
  followUp: {
    id: string;
    dueAt: string;
    escalationCount: number;
    originalOwner: { id: string; name: string };
    sourceCall: { userResponse: string | null; notes: string | null };
  } | null;
  customer: CustomerProfile;
}

export interface Assignment {
  id: string;
  status: AssignmentStatus;
  source: AssignmentSource;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'priority' | 'status'>;
  staff: { id: string; name: string; role: StaffRole };
  createdBy: { id: string; name: string } | null;
}

export interface AssignableStaff {
  id: string;
  name: string;
  role: StaffRole;
  availability: Availability;
  team: { name: string } | null;
}

// ---- Follow-ups + notifications (Phase 3) ----
export type FollowUpStatus =
  'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type FollowUpBucket =
  'open' | 'upcoming' | 'due' | 'overdue' | 'completed' | 'cancelled';

export interface FollowUp {
  id: string;
  status: FollowUpStatus;
  dueAt: string;
  escalationCount: number;
  escalatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string; priority: Priority };
  owner: { id: string; name: string };
  originalOwner: { id: string; name: string };
  sourceCall: {
    userResponse: string | null;
    notes: string | null;
    interestRating: number | null;
    outcome: { label: string };
  };
}

export interface FollowUpSummary {
  upcoming: number;
  due: number;
  overdue: number;
  completedToday: number;
}

export interface FollowUpTimingConfig {
  reminderMinutesBefore: number;
  gracePeriodMinutes: number;
  presenceTimeoutMinutes: number;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// ---- Rating, categories & tags (Phase 4) ----
export type Tone = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'indigo';

export interface Category {
  id: string;
  code: string;
  label: string;
  minRating: number;
  maxRating: number;
  color: Tone;
  priority: Priority | null;
  isActive: boolean;
  sortOrder: number;
}

export type CategoryRef = Pick<Category, 'id' | 'code' | 'label' | 'color'>;

export interface Tag {
  id: string;
  name: string;
  color: Tone;
  isActive: boolean;
  _count?: { customers: number };
}

export type TagRef = Pick<Tag, 'id' | 'name' | 'color'>;

export interface CategorySummary {
  categories: (CategoryRef & { count: number })[];
  uncategorized: number;
}

export interface CategoryChange {
  id: string;
  createdAt: string;
  rating: number | null;
  reason: 'call_rating' | 'threshold_change' | string;
  from: CategoryRef | null;
  to: CategoryRef | null;
  changedBy: { id: string; name: string } | null;
}
