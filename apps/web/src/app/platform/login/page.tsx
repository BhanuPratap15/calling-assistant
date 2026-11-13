'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { Icon } from '@/components/ui/icons';
import { api, ApiError } from '@/lib/api';

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/platform/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      router.replace('/platform');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Incorrect email or password'
          : err instanceof Error
            ? err.message
            : 'Login failed',
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(160deg,#0b1020_0%,#1e1b4b_100%)] px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex items-center gap-3 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 ring-1 ring-white/20">
            <Icon name="building" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold">Platform console</p>
            <p className="text-sm text-white/60">Manage white-label clients</p>
          </div>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl bg-white p-7 shadow-pop"
        >
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={busy} className="w-full py-2.5">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
