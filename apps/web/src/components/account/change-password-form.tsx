'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

// Backend PASSWORD_RULE (is-valid-password.decorator.ts) jaisa — sync rakho
const RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/**
 * Password badlo. Server baaki saare sessions (doosre browser / phone) logout kar deta hai
 * aur is browser ko naya login cookie deta hai.
 */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setDone(false);
    if (!RULE.test(form.next))
      return setError(
        'Naya password 8+ characters ka ho, kam se kam 1 letter aur 1 number',
      );
    if (form.next !== form.confirm)
      return setError('Dono naye password same nahi hain');
    if (form.next === form.current)
      return setError('Naya password purane se alag hona chahiye');
    setSaving(true);
    setError(null);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: form.current, newPassword: form.next },
      });
      setForm({ current: '', next: '', confirm: '' });
      setDone(true);
      await refreshUser(); // mustChangePassword false → app khul jaata hai
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label="Current password">
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={form.current}
          onChange={(e) => setForm({ ...form, current: e.target.value })}
        />
      </Field>
      <Field
        label="New password"
        hint="8+ characters, kam se kam 1 letter aur 1 number"
      >
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={form.next}
          onChange={(e) => setForm({ ...form, next: e.target.value })}
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
      </Field>
      <ErrorMessage message={error} />
      {done && (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          Password badal gaya ✓ — doosre devices se logout ho gaye
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
