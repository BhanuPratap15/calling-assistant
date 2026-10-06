import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const STYLES: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-brand hover:bg-indigo-700 active:bg-indigo-800',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  danger: 'bg-red-600 text-white shadow-brand hover:bg-red-700',
  ghost: 'text-indigo-700 hover:bg-indigo-50',
};

/** Ek jaisa button poore app me: <Button variant="secondary">Cancel</Button> */
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${STYLES[variant]} ${className}`}
      {...props}
    />
  );
}
