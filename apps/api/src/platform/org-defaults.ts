import type { Prisma } from '../generated/prisma/client.js';

/**
 * Naye client ki shuruaati settings — wahi jo pehle migrations ne single-client ke liye daali thi.
 * Client baad me Settings page se badal sakta hai.
 */
export const DEFAULT_OUTCOMES = [
  { code: 'CONNECTED', label: 'Connected', isConnected: true, sortOrder: 10 },
  { code: 'INTERESTED', label: 'Interested', isConnected: true, sortOrder: 20 },
  {
    code: 'NOT_INTERESTED',
    label: 'Not Interested',
    isConnected: true,
    sortOrder: 30,
  },
  { code: 'NO_ANSWER', label: 'No Answer', isConnected: false, sortOrder: 40 },
  { code: 'BUSY', label: 'Busy', isConnected: false, sortOrder: 50 },
  {
    code: 'SWITCHED_OFF',
    label: 'Switched Off',
    isConnected: false,
    sortOrder: 60,
  },
  {
    code: 'WRONG_NUMBER',
    label: 'Wrong Number',
    isConnected: false,
    sortOrder: 70,
  },
];

export const DEFAULT_NEXT_ACTIONS = [
  {
    code: 'NO_FURTHER_ACTION',
    label: 'No Further Action',
    requiresFollowUp: false,
    sortOrder: 10,
  },
  {
    code: 'FOLLOW_UP',
    label: 'Follow-up',
    requiresFollowUp: true,
    sortOrder: 20,
  },
  {
    code: 'CALL_AGAIN',
    label: 'Call Again',
    requiresFollowUp: true,
    sortOrder: 30,
  },
  {
    code: 'SEND_INFORMATION',
    label: 'Send Information',
    requiresFollowUp: false,
    sortOrder: 40,
  },
  {
    code: 'ESCALATE',
    label: 'Escalate',
    requiresFollowUp: false,
    sortOrder: 50,
  },
];

export const DEFAULT_CATEGORIES = [
  {
    code: 'LOW_INTEREST',
    label: 'Low Interest',
    minRating: 0,
    maxRating: 4,
    color: 'gray',
    priority: 'LOW',
    sortOrder: 10,
  },
  {
    code: 'MEDIUM_INTEREST',
    label: 'Medium Interest',
    minRating: 5,
    maxRating: 7,
    color: 'blue',
    priority: 'NORMAL',
    sortOrder: 20,
  },
  {
    code: 'HIGH_INTEREST',
    label: 'High Interest',
    minRating: 8,
    maxRating: 9,
    color: 'yellow',
    priority: 'HIGH',
    sortOrder: 30,
  },
  {
    code: 'VIP',
    label: 'VIP',
    minRating: 10,
    maxRating: 10,
    color: 'red',
    priority: 'URGENT',
    sortOrder: 40,
  },
] as const;

export const DEFAULT_SETTINGS: { key: string; value: Prisma.InputJsonValue }[] =
  [
    {
      key: 'call_form.required_fields',
      value: {
        userResponse: 'connected',
        notes: 'connected',
        interestRating: 'connected',
      },
    },
    {
      key: 'follow_up.timing',
      value: {
        reminderMinutesBefore: 1,
        gracePeriodMinutes: 10,
        presenceTimeoutMinutes: 5,
      },
    },
  ];

/** Naye org ke liye saari default rows (transaction ke andar, organizationId explicit) */
export async function seedOrganizationDefaults(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  await tx.callOutcome.createMany({
    data: DEFAULT_OUTCOMES.map((o) => ({ ...o, organizationId })),
  });
  await tx.nextAction.createMany({
    data: DEFAULT_NEXT_ACTIONS.map((a) => ({ ...a, organizationId })),
  });
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, organizationId })),
  });
  await tx.systemSetting.createMany({
    data: DEFAULT_SETTINGS.map((s) => ({ ...s, organizationId })),
  });
}
