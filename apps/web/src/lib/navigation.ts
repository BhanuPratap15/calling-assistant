import type { StaffRole } from './types';

/**
 * Sidebar menu — kaunsa item kis role ko dikhega. Naya page = yahan ek line.
 * Note: ye sirf DIKHANE ke liye hai. Asli security backend ke @Roles() guard me hai.
 */
export interface NavItem {
  href: string;
  label: string;
  roles: StaffRole[]; // SUPER_ADMIN ko sab dikhta hai (canSee me)
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    roles: ['MANAGER', 'TEAM_LEADER', 'ASSISTANT'],
  },
  {
    href: '/calling',
    label: 'Start Calling',
    roles: ['ASSISTANT', 'TEAM_LEADER'],
  },
  {
    href: '/follow-ups',
    label: 'Follow-ups',
    roles: ['MANAGER', 'TEAM_LEADER', 'ASSISTANT'],
  },
  { href: '/customers', label: 'Customers', roles: ['MANAGER', 'TEAM_LEADER'] },
  {
    href: '/assignments',
    label: 'Assignments',
    roles: ['MANAGER', 'TEAM_LEADER'],
  },
  { href: '/teams', label: 'Teams', roles: ['MANAGER', 'TEAM_LEADER'] },
  { href: '/staff', label: 'Staff', roles: ['MANAGER'] },
  { href: '/audit-logs', label: 'Audit Logs', roles: ['MANAGER'] },
  { href: '/settings', label: 'Settings', roles: ['MANAGER'] },
];

export function canSee(item: NavItem, role: StaffRole): boolean {
  return role === 'SUPER_ADMIN' || item.roles.includes(role);
}

/** URL ke liye matching nav item (e.g. /customers/123 → Customers) */
export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
