'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { OrgDetail } from '@/lib/platform';
import { DialerFields } from './dialer-fields';
import { Section } from './section';

/** Dialer + plan / limits + company / contact (branding alag tab me) */
export function OrgSettingsTab({
  org,
  onSaved,
}: {
  org: OrgDetail;
  onSaved: () => void;
}) {
  const initial = () => ({
    name: org.name,
    slug: org.slug,
    dialerMode: org.dialerMode,
    externalDialerUrl: org.externalDialerUrl ?? '',
    plan: org.plan ?? '',
    maxStaff: org.maxStaff ? String(org.maxStaff) : '',
    contactName: org.contactName ?? '',
    contactEmail: org.contactEmail ?? '',
    contactPhone: org.contactPhone ?? '',
    notes: org.notes ?? '',
  });
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<ReturnType<typeof initial>>) =>
    setV((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(v) !== JSON.stringify(initial());

  async function save() {
    if (
      v.slug !== org.slug &&
      !window.confirm(
        'Changing the slug changes the built-in sub-domain address. Users of the old address must use the new one. Continue?',
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api(`/platform/organizations/${org.id}`, {
        method: 'PATCH',
        body: {
          name: v.name.trim(),
          slug: v.slug.trim(),
          dialerMode: v.dialerMode,
          externalDialerUrl: v.externalDialerUrl.trim() || null,
          plan: v.plan.trim() || null,
          maxStaff: v.maxStaff ? Number(v.maxStaff) : null,
          contactName: v.contactName.trim() || null,
          contactEmail: v.contactEmail.trim() || null,
          contactPhone: v.contactPhone.trim() || null,
          notes: v.notes.trim() || null,
        },
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
    <div className="space-y-6">
      <Section
        title="Dialer"
        description="How this client's callers place calls. Calls, notes, follow-ups and reports are recorded in the CRM in every mode."
      >
        <DialerFields
          value={{
            dialerMode: v.dialerMode,
            externalDialerUrl: v.externalDialerUrl,
          }}
          onChange={set}
        />
      </Section>

      <Section title="Plan & limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan (label)">
            <Input
              value={v.plan}
              onChange={(e) => set({ plan: e.target.value })}
            />
          </Field>
          <Field
            label="Max active users"
            hint={`Empty = unlimited · currently ${org.usage.activeStaff} active`}
          >
            <Input
              type="number"
              min={1}
              value={v.maxStaff}
              onChange={(e) => set({ maxStaff: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Company & contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name">
            <Input
              required
              value={v.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field label="Slug" hint="Changes the built-in sub-domain">
            <Input
              required
              value={v.slug}
              onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
            />
          </Field>
          <Field label="Contact person">
            <Input
              value={v.contactName}
              onChange={(e) => set({ contactName: e.target.value })}
            />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={v.contactEmail}
              onChange={(e) => set({ contactEmail: e.target.value })}
            />
          </Field>
          <Field label="Contact phone">
            <Input
              value={v.contactPhone}
              onChange={(e) => set({ contactPhone: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Internal notes">
            <Textarea
              value={v.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        {dirty && (
          <Button variant="secondary" onClick={() => setV(initial())}>
            Reset
          </Button>
        )}
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
}
