'use client';

import { useState, type FormEvent } from 'react';
import { Section } from '@/components/platform/section';
import { usePlatformUser } from '@/components/platform/platform-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function PlatformTeamPage() {
  const me = usePlatformUser();
  const { data, error, reload } = useApi<PlatformAdmin[]>('/platform/admins');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api('/platform/admins', { method: 'POST', body: form });
      setForm({ name: '', email: '', password: '' });
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: PlatformAdmin) {
    try {
      await api(`/platform/admins/${a.id}`, {
        method: 'PATCH',
        body: { isActive: !a.isActive },
      });
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Platform team"
        description="People who can create and manage clients. Every one of them has full platform access."
      />
      <div className="space-y-6">
        <Section title="Platform admins">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <ul className="divide-y divide-slate-100">
            {data?.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {a.name}{' '}
                    {a.id === me?.id && (
                      <span className="text-xs text-slate-400">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.email} · last login {formatDateTime(a.lastLoginAt)}
                  </p>
                </div>
                <Badge tone={a.isActive ? 'green' : 'red'}>
                  {a.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {a.id !== me?.id && (
                  <Button variant="ghost" onClick={() => toggle(a)}>
                    {a.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Add platform admin">
          <form
            onSubmit={add}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <Field label="Name">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Password" hint="8+ chars, letter + number">
              <Input
                required
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={busy} className="sm:mb-6">
              Add
            </Button>
          </form>
          <ErrorMessage message={formError} />
        </Section>
      </div>
    </>
  );
}
