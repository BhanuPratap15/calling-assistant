'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/copy-button';
import { copyText } from '@/lib/clipboard';
import type { Credentials } from '@/lib/platform';

/**
 * Naye / reset kiye admin ka login — SIRF EK BAAR dikhta hai (server password save nahi karta,
 * sirf hash). Client ko bhejne ke liye ready message bhi.
 */
export function CredentialsCard({
  credentials,
  brandName,
}: {
  credentials: Credentials;
  brandName: string;
}) {
  const [copied, setCopied] = useState(false);
  const message = [
    `Your ${brandName} account is ready.`,
    credentials.loginUrl ? `Login: ${credentials.loginUrl}` : null,
    `Email: ${credentials.email}`,
    `Temporary password: ${credentials.password}`,
    'You will be asked to set your own password on first login.',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">
        Login details — copy them now, the password is not shown again
      </p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {(
          [
            ['Login URL', credentials.loginUrl ?? '— add a domain first'],
            ['Email', credentials.email],
            ['Password', credentials.password],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <dt className="w-24 shrink-0 text-emerald-800/70">{k}</dt>
            <dd className="min-w-0 truncate font-mono text-emerald-950">{v}</dd>
            {k !== 'Login URL' || credentials.loginUrl ? (
              <CopyButton text={v} label={`Copy ${k}`} />
            ) : null}
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={async () => setCopied(await copyText(message))}
        className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {copied ? 'Copied ✓' : 'Copy message for the client'}
      </button>
    </div>
  );
}
