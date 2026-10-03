import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

/**
 * (app) = "route group": brackets wala folder URL me nahi aata.
 * /dashboard, /customers... sab yahi layout (sidebar + header) use karte hain.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
