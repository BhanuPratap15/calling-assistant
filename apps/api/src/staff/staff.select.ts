import type { Prisma } from '../generated/prisma/client.js';

/**
 * Staff ke kaunse columns API response me jaate hain — ek jagah define.
 * passwordHash yahan NAHI hai → kabhi leak nahi hoga.
 */
export const staffPublicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  availability: true,
  isActive: true,
  teamId: true,
  team: { select: { id: true, name: true } },
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StaffSelect;
