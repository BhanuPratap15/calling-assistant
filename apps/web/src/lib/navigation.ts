import type { IconName } from '@/components/ui/icons';
import type { StaffRole } from './types';

/**
 * Sidebar menu — kaunsa item kis role ko dikhega. Naya page = yahan ek line.
 * Note: ye sirf DIKHANE ke liye hai. Asli security backend ke @Roles() guard me hai.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: StaffRole[]; // SUPER_ADMIN ko sab dikhta hai (canSee me)
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    roles: ['MANAGER', 'TEAM_LEADER', 'ASSISTANT'],
  },
  {
    href: '/calling',
    label: 'Start Calling',
    icon: 'phone',
    roles: ['ASSISTANT', 'TEAM_LEADER'],
  },
  {
    href: '/follow-ups',
    label: 'Follow-ups',
    icon: 'clock',
    roles: ['MANAGER', 'TEAM_LEADER', 'ASSISTANT'],
  },
  {
    href: '/customers',
    label: 'Customers',
    icon: 'users',
    roles: ['MANAGER', 'TEAM_LEADER'],
  },
  {
    href: '/campaigns',
    label: 'Campaigns',
    icon: 'megaphone',
    roles: ['MANAGER', 'TEAM_LEADER'],
  },
  {
    href: '/assignments',
    label: 'Assignments',
    icon: 'shuffle',
    roles: ['MANAGER', 'TEAM_LEADER'],
  },
  {
    href: '/teams',
    label: 'Teams',
    icon: 'team',
    roles: ['MANAGER', 'TEAM_LEADER'],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: 'chart',
    roles: ['MANAGER', 'TEAM_LEADER'],
  },
  { href: '/imports', label: 'Import', icon: 'upload', roles: ['MANAGER'] },
  { href: '/staff', label: 'Staff', icon: 'idCard', roles: ['MANAGER'] },
  {
    href: '/audit-logs',
    label: 'Audit Logs',
    icon: 'scroll',
    roles: ['MANAGER'],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: 'settings',
    roles: ['MANAGER'],
  },
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
