'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // "State" = component ki yaaddasht. Value badli → screen dobara render.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // browser ka default form submit (page reload) roko
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Sirf apne app ke andar ke path pe wapas jao (open redirect se bachav)
      const next = searchParams.get('next');
      router.replace(
        next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard',
      );
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Incorrect email or password'
          : err instanceof ApiError && err.unreachable
            ? err.message
            : 'Login failed. Please try again in a little while.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-xs placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-xs placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="animate-fade-in rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-brand hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60"
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[var(--sidebar-bg)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-white shadow-lg shadow-indigo-900/50 ring-1 ring-white/15">
            <Icon name="phone" className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            Calling CRM
          </span>
        </div>

        <div className="relative max-w-md animate-fade-up">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            Every call counts.
            <br />
            <span className="bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
              Never miss a follow-up.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            One customer at a time, smart follow-up reminders, and complete
            visibility for your team — all in one place.
          </p>
          <div className="mt-8 flex gap-8">
            {[
              ['Live', 'call tracking'],
              ['Auto', 'follow-ups'],
              ['360°', 'customer view'],
            ].map(([k, v]) => (
              <div key={v}>
                <p className="text-xl font-semibold text-white">{k}</p>
                <p className="text-xs text-white/50">{v}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Calling CRM
        </p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 text-white shadow-lg shadow-indigo-500/30">
              <Icon name="phone" className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Calling CRM
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mb-8 mt-1.5 text-sm text-slate-500">
            Sign in to your account to continue
          </p>
          {/* useSearchParams ke liye Suspense zaroori hai (Next.js rule) */}
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
