import type { Prisma } from '../generated/prisma/client.js';

/**
 * Customer 360° profile (design doc section 12) — ek query me:
 *   details + abhi kiske paas hai + call history (newest first)
 */
export const OPEN_ASSIGNMENT_WHERE = {
  openCustomerId: { not: null },
} satisfies Prisma.AssignmentWhereInput;

export const customerProfileInclude = {
  assignments: {
    where: OPEN_ASSIGNMENT_WHERE,
    select: {
      id: true,
      status: true,
      source: true,
      createdAt: true,
      staff: { select: { id: true, name: true } },
    },
  },
  calls: {
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      userResponse: true,
      notes: true,
      interestRating: true,
      followUpAt: true,
      outcome: { select: { code: true, label: true, isConnected: true } },
      nextAction: {
        select: { code: true, label: true, requiresFollowUp: true },
      },
      staff: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.CustomerInclude;

export type CustomerProfile = Prisma.CustomerGetPayload<{
  include: typeof customerProfileInclude;
}>;
