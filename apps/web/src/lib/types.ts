// Backend ke types ka frontend copy (aage chal ke shared package bana sakte hain)

export type StaffRole = 'SUPER_ADMIN' | 'MANAGER' | 'TEAM_LEADER' | 'ASSISTANT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  availability?: Availability; // /auth/me se (login response me nahi)
  mustChangePassword?: boolean; // manager ne password set kiya → pehle khud badlo (Phase 9)
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
  campaign: { id: string; name: string } | null;
  customFields: Record<string, CustomFieldValue> | null;
  telephony: Pick<
    CallSession,
    'id' | 'status' | 'durationSec' | 'recordingUrl' | 'toNumber'
  >[];
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
  campaigns: {
    callCount: number;
    lastCalledAt: string | null;
    campaign: { id: string; name: string; status: CampaignStatus };
  }[];
}

export interface CurrentAssignment {
  id: string;
  source: AssignmentSource;
  startedAt: string | null;
  campaign: {
    id: string;
    name: string;
    script: string | null;
    fields: CampaignFieldDef[];
  } | null;
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
  campaign: { id: string; name: string } | null;
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

// ---- Campaigns (Phase 5) ----
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type CampaignFieldType = 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN';
export type CustomFieldValue = string | number | boolean;

export const CAMPAIGN_FIELD_TYPES: CampaignFieldType[] = [
  'TEXT',
  'NUMBER',
  'SELECT',
  'BOOLEAN',
];

/** Calling screen ko jo fields milte hain (sirf active) */
export interface CampaignFieldDef {
  id: string;
  key: string;
  label: string;
  type: CampaignFieldType;
  options: string[];
  required: boolean;
}

export interface CampaignField extends CampaignFieldDef {
  isActive: boolean;
  sortOrder: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  priority: number;
  script: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  _count: { customers: number; staff: number; teams: number };
  progress: { total: number; called: number };
}

export interface CampaignStats {
  total: number;
  called: number;
  pending: number;
  byOutcome: { label: string; isConnected: boolean; count: number }[];
}

export interface CampaignDetail extends Omit<Campaign, '_count' | 'progress'> {
  createdBy: { id: string; name: string } | null;
  staff: { staff: { id: string; name: string; role: StaffRole } }[];
  teams: { team: { id: string; name: string } }[];
  fields: CampaignField[];
  stats: CampaignStats;
}

export interface CampaignCustomer {
  callCount: number;
  lastCalledAt: string | null;
  addedAt: string;
  customer: Pick<
    Customer,
    'id' | 'name' | 'phone' | 'status' | 'priority' | 'interestRating'
  > & { category: CategoryRef | null };
}

// ---- Bulk import (Phase 6) ----
export type ImportStatus =
  'PREVIEW' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ImportRowStatus =
  'VALID' | 'INVALID' | 'DUPLICATE' | 'IMPORTED' | 'SKIPPED';

export interface ImportBatch {
  id: string;
  fileName: string;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  ignoredColumns: string[];
  error: string | null;
  confirmedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  tag: TagRef | null;
}

export interface ImportRow {
  id: string;
  rowNumber: number;
  raw: Partial<Record<string, string>>; // name, phone, email... (file me jaisa tha)
  status: ImportRowStatus;
  errors: string[];
  customerId: string | null;
}

// ---- Calling provider (Phase 7) ----
export type CallSessionStatus =
  | 'DIALED'
  | 'INITIATED'
  | 'RINGING'
  | 'ANSWERED'
  | 'COMPLETED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'FAILED'
  | 'CANCELED';

export interface CallSession {
  id: string;
  provider: string;
  status: CallSessionStatus;
  toNumber: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  recordingUrl: string | null;
  failReason: string | null;
  createdAt: string;
}

export interface TelephonyConfig {
  provider: string;
  mode: 'manual' | 'api';
}

// ---- Dashboard & reports (Phase 8) ----
export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface ReportRange {
  preset: RangePreset;
  start: string;
  end: string;
  days?: number;
  timezone: string;
}

export interface ReportSummary {
  range: ReportRange;
  kpis: {
    calls: number;
    connected: number;
    connectRate: number | null;
    avgRating: number | null;
    customers: number;
    followUpsPromised: number;
    dials: number;
    answered: number;
    talkTimeSec: number;
  };
  previous: {
    calls: number;
    connectRate: number | null;
    avgRating: number | null;
  };
  daily: { day: string; calls: number; connected: number }[];
  byHour: { hour: number; calls: number; connected: number }[];
  outcomes: { label: string; isConnected: boolean; calls: number }[];
  followUps: {
    due: number;
    completed: number;
    onTime: number;
    onTimeRate: number | null;
    escalated: number;
    overdueNow: number;
  };
}

export interface AssistantReportRow {
  id: string;
  name: string;
  role: StaffRole;
  team: string | null;
  availability: Availability;
  lastSeenAt: string | null;
  calls: number;
  connected: number;
  connectRate: number | null;
  avgRating: number | null;
  followUpsPromised: number;
  dials: number;
  talkTimeSec: number;
  avgTalkSec: number | null;
  followUpsDue: number;
  followUpsCompleted: number;
  overdueNow: number;
  lastCallAt: string | null;
}

export interface CampaignReportRow {
  id: string;
  name: string;
  status: CampaignStatus;
  priority: number;
  customers: number;
  called: number;
  progress: number | null;
  calls: number;
  connected: number;
  connectRate: number | null;
  avgRating: number | null;
}
