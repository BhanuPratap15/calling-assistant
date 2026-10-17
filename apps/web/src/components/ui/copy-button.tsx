'use client';

import { useEffect, useState } from 'react';
import { copyText, localPhone } from '@/lib/clipboard';
import { Icon } from './icons';

/** Ek click me copy (phone number waghera) — 1.5s ke liye ✓ dikhata hai */
export function CopyButton({
  text,
  label = 'Copy',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault(); // Link / row click ke andar ho to navigate na kare
        e.stopPropagation();
        if (await copyText(text)) setCopied(true);
      }}
      title={copied ? 'Copied' : `${label} ${text}`}
      aria-label={copied ? 'Copied' : `${label} ${text}`}
      className={`inline-flex items-center justify-center rounded p-1 align-middle text-slate-400 hover:bg-slate-100 hover:text-slate-700 ${copied ? 'text-green-600 hover:text-green-600' : ''} ${className}`}
    >
      <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
    </button>
  );
}

/** Phone number copy (+91 ke bina) */
export function CopyPhoneButton({
  phone,
  label = 'Copy number',
  className,
}: {
  phone: string;
  label?: string;
  className?: string;
}) {
  return (
    <CopyButton text={localPhone(phone)} label={label} className={className} />
  );
}

/** Number + copy button saath me (lists / tables) */
export function PhoneText({ phone }: { phone: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono">
      {phone}
      <CopyPhoneButton phone={phone} />
    </span>
  );
}
