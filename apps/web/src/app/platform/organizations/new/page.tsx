'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { BrandPreview } from '@/components/platform/brand-preview';
import {
  BrandingFields,
  brandingPayload,
  type BrandingValue,
} from '@/components/platform/branding-fields';
import { CredentialsCard } from '@/components/platform/credentials-card';
import { DialerFields } from '@/components/platform/dialer-fields';
import { Section } from '@/components/platform/section';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input, Textarea } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import {
  slugify,
  type Credentials,
  type DialerMode,
  type OrgDetail,
  type PlatformOverview,
} from '@/lib/platform';
import { useApi } from '@/lib/use-api';

export default function NewClientPage() {
  const overview = useApi<PlatformOverview>('/platform/overview');
  const base = overview.data?.dns.baseDomain;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [brand, setBrand] = useState<BrandingValue>({
    brandName: '',
    tagline: '',
    logoUrl: null,
    faviconUrl: null,
    themePreset: 'violet',
    primaryColor: null,
    sidebarStyle: 'dark',
    loginStyle: 'split',
    supportEmail: '',
    supportPhone: '',
  });
  const [dialer, setDialer] = useState<{
    dialerMode: DialerMode;
    externalDialerUrl: string;
  }>({ dialerMode: 'PLATFORM', externalDialerUrl: '' });
  const [plan, setPlan] = useState('');
  const [maxStaff, setMaxStaff] = useState('');
  const [contact, setContact] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  });
  const [admin, setAdmin] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{
    organization: OrgDetail;
    adminCredentials: Credentials;
  } | null>(null);

  const effectiveBrand = brand.brandName || name;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{
        organization: OrgDetail;
        adminCredentials: Credentials;
      }>('/platform/organizations', {
        method: 'POST',
        body: {
          name: name.trim(),
          slug,
          customDomain: customDomain.trim() || null,
          ...brandingPayload({ ...brand, brandName: effectiveBrand }),
          dialerMode: dialer.dialerMode,
          externalDialerUrl: dialer.externalDialerUrl.trim() || null,
          plan: plan.trim() || null,
          maxStaff: maxStaff ? Number(maxStaff) : null,
          contactName: contact.contactName.trim() || null,
          contactEmail: contact.contactEmail.trim() || null,
          contactPhone: contact.contactPhone.trim() || null,
          notes: contact.notes.trim() || null,
          admin: {
            name: admin.name.trim(),
            email: admin.email.trim(),
            ...(admin.password ? { password: admin.password } : {}),
          },
        },
      });
      setCreated(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title={`${created.organization.brandName} is ready 🎉`}
          description="The workspace, its default settings and the first admin were created."
        />
        <CredentialsCard
          credentials={created.adminCredentials}
          brandName={created.organization.brandName}
        />
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Next steps</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Point the client&apos;s domain(s) to this server (DNS) — see the
              Domains tab.
            </li>
            <li>
              SSL is issued automatically within a few minutes after DNS works.
            </li>
            <li>Send the login details to the client admin.</li>
          </ol>
        </div>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/platform/organizations/${created.organization.id}`}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open client
          </Link>
          <Link
            href="/platform"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            All clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="New client"
        description="Create a white-label workspace: brand, theme, domain, dialer and the first admin"
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="1. Company">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name">
                <Input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugTouched) setSlug(slugify(e.target.value));
                  }}
                />
              </Field>
              <Field
                label="Slug (workspace id)"
                hint={
                  base
                    ? `Web address: ${slug || 'slug'}.${base}`
                    : 'Lowercase letters, digits and hyphens'
                }
              >
                <Input
                  required
                  pattern="[a-z0-9](?:[a-z0-9\-]{0,30}[a-z0-9])?"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                />
              </Field>
              <Field
                label="Client's own domain (optional)"
                hint="e.g. crm.clientcompany.com — can be added later too"
              >
                <Input
                  placeholder="crm.clientcompany.com"
                  value={customDomain}
                  onChange={(e) =>
                    setCustomDomain(e.target.value.toLowerCase())
                  }
                />
              </Field>
            </div>
          </Section>

          <Section title="2. Branding & theme">
            <BrandingFields
              value={{ ...brand, brandName: brand.brandName }}
              onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))}
            />
            {!brand.brandName && name && (
              <p className="mt-2 text-xs text-slate-500">
                Brand name empty → “{name}” will be used.
              </p>
            )}
          </Section>

          <Section title="3. Dialer">
            <DialerFields
              value={dialer}
              onChange={(patch) => setDialer((d) => ({ ...d, ...patch }))}
            />
          </Section>

          <Section title="4. Plan & contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan (label)" hint="e.g. Starter, Pro">
                <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
              </Field>
              <Field label="Max active users" hint="Empty = unlimited">
                <Input
                  type="number"
                  min={1}
                  value={maxStaff}
                  onChange={(e) => setMaxStaff(e.target.value)}
                />
              </Field>
              <Field label="Contact person">
                <Input
                  value={contact.contactName}
                  onChange={(e) =>
                    setContact({ ...contact, contactName: e.target.value })
                  }
                />
              </Field>
              <Field label="Contact email">
                <Input
                  type="email"
                  value={contact.contactEmail}
                  onChange={(e) =>
                    setContact({ ...contact, contactEmail: e.target.value })
                  }
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={contact.contactPhone}
                  onChange={(e) =>
                    setContact({ ...contact, contactPhone: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Internal notes" hint="Only visible on the platform">
                <Textarea
                  value={contact.notes}
                  onChange={(e) =>
                    setContact({ ...contact, notes: e.target.value })
                  }
                />
              </Field>
            </div>
          </Section>

          <Section title="5. First admin (client's Super Admin)">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name">
                <Input
                  required
                  value={admin.name}
                  onChange={(e) => setAdmin({ ...admin, name: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  required
                  type="email"
                  value={admin.email}
                  onChange={(e) =>
                    setAdmin({ ...admin, email: e.target.value })
                  }
                />
              </Field>
              <Field label="Password" hint="Empty = generate one">
                <Input
                  type="text"
                  autoComplete="new-password"
                  value={admin.password}
                  onChange={(e) =>
                    setAdmin({ ...admin, password: e.target.value })
                  }
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              The admin must set their own password at first login.
            </p>
          </Section>

          <ErrorMessage message={error} />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create client'}
            </Button>
            <Link
              href="/platform"
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <BrandPreview draft={{ ...brand, brandName: effectiveBrand }} />
        </div>
      </div>
    </form>
  );
}
