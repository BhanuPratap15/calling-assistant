'use client';

import { OrgActivityTab } from '@/components/platform/org-activity-tab';
import { PageHeader } from '@/components/ui/page-header';

export default function PlatformActivityPage() {
  return (
    <>
      <PageHeader
        title="Activity"
        description="Platform audit log — clients created, branding / domain changes, logins"
      />
      <OrgActivityTab />
    </>
  );
}
