'use client';

import { useState, type FormEvent } from 'react';
import { Section } from '@/components/platform/section';
import { usePlatformUser } from '@/components/platform/platform-shell';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';

export default function PlatformAccountPage() {
  const me = usePlatformUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api('/platform/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setCurrent('');
      setNext('');
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My account"
        description={me ? `${me.name} · ${me.email}` : undefined}
      />
      <div className="max-w-md">
        <Section
          title="Change password"
          description="Other sessions are logged out"
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Current password">
              <Input
                required
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field
              label="New password"
              hint="8+ characters with a letter and a number"
            >
              <Input
                required
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>
            <ErrorMessage message={error} />
            {done && (
              <p className="text-sm text-emerald-600">Password changed ✓</p>
            )}
            <Button type="submit" disabled={busy}>
              Change password
            </Button>
          </form>
        </Section>
      </div>
    </>
  );
}
