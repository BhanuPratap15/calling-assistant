'use client';

import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Credentials, OrgDetail } from '@/lib/platform';
import { CredentialsCard } from './credentials-card';
import { Section } from './section';

/**
 * Client ke admins (Super Admin / Manager). Platform yahan se naya admin bana sakta hai ya
 * bhoola hua password reset kar sakta hai. Baaki staff client khud manage karta hai.
 */
export function OrgAdminsTab({
  org,
  onChanged,
}: {
  org: OrgDetail;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ credentials: Credentials }>(
        `/platform/organizations/${org.id}/admins`,
        {
          method: 'POST',
          body: {
            name: form.name.trim(),
            email: form.email.trim(),
            ...(form.password ? { password: form.password } : {}),
          },
        },
      );
      setCreds(res.credentials);
      setForm({ name: '', email: '', password: '' });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset(staffId: string, name: string) {
    if (
      !window.confirm(
        `Reset ${name}'s password? They are logged out everywhere and must set a new password after logging in with the temporary one.`,
      )
    )
      return;
    setError(null);
    try {
      const res = await api<{ credentials: Credentials }>(
        `/platform/organizations/${org.id}/staff/${staffId}/reset-password`,
        { method: 'POST' },
      );
      setCreds(res.credentials);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      {creds && (
        <CredentialsCard credentials={creds} brandName={org.brandName} />
      )}
      <Section
        title="Workspace admins"
        description="Super Admins and Managers of this client. They manage their own staff, teams and settings inside the CRM."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Last login</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {org.admins.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-500">{a.email}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    {a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Manager'}
                  </td>
                  <td className="py-2.5 pr-3">
                    {!a.isActive ? (
                      <Badge tone="red">Inactive</Badge>
                    ) : a.mustChangePassword ? (
                      <Badge tone="yellow">Must set password</Badge>
                    ) : (
                      <Badge tone="green">Active</Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {formatDateTime(a.lastLoginAt)}
                  </td>
                  <td className="py-2.5 text-right">
                    <Button variant="ghost" onClick={() => reset(a.id, a.name)}>
                      Reset password
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Add a Super Admin">
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
          <Field label="Password" hint="Empty = generate">
            <Input
              value={form.password}
              autoComplete="new-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          <Button type="submit" disabled={busy} className="sm:mb-6">
            Add admin
          </Button>
        </form>
        <ErrorMessage message={error} />
      </Section>
    </div>
  );
}
