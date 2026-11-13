'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { OrgDetail } from '@/lib/platform';
import { BrandPreview } from './brand-preview';
import {
  BrandingFields,
  brandingPayload,
  type BrandingValue,
} from './branding-fields';
import { Section } from './section';

const fromOrg = (org: OrgDetail): BrandingValue => ({
  brandName: org.brandName,
  tagline: org.tagline ?? '',
  logoUrl: org.logoUrl,
  faviconUrl: org.faviconUrl,
  themePreset: org.themePreset,
  primaryColor: org.primaryColor,
  sidebarStyle: org.sidebarStyle,
  loginStyle: org.loginStyle,
  supportEmail: org.supportEmail ?? '',
  supportPhone: org.supportPhone ?? '',
});

export function OrgBrandingTab({
  org,
  onSaved,
}: {
  org: OrgDetail;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<BrandingValue>(() => fromOrg(org));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(fromOrg(org));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/platform/organizations/${org.id}`, {
        method: 'PATCH',
        body: brandingPayload(value),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Section
        title="Branding & theme"
        description="Applies to the client's whole app and login page — users see it on their next page load"
      >
        <BrandingFields
          value={value}
          onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
        />
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save branding'}
          </Button>
          {dirty && (
            <Button variant="secondary" onClick={() => setValue(fromOrg(org))}>
              Reset
            </Button>
          )}
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        </div>
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      </Section>
      <div className="xl:sticky xl:top-8 xl:self-start">
        <BrandPreview draft={value} />
      </div>
    </div>
  );
}
