import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PlatformShell } from '@/components/platform/platform-shell';
import { themeCss } from '@/lib/theme';

export const metadata: Metadata = {
  title: { default: 'Platform console', template: '%s · Platform' },
};

/**
 * /platform/* — white-label platform panel. Jis bhi host pe khule, apna fixed look
 * (client ke theme se alag) — isliye yahan indigo theme override.
 */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: themeCss({ themePreset: 'indigo', sidebarStyle: 'dark' }),
        }}
      />
      <PlatformShell>{children}</PlatformShell>
    </>
  );
}
