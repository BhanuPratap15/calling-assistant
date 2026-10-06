import type { ReactNode } from 'react';

type Tone = 'gray' | 'green' | 'red' | 'yellow' | 'blue' | 'indigo';

const TONES: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
};

export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
