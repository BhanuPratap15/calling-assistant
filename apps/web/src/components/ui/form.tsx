'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// Width default w-full; caller className (e.g. "w-44") de to wahi lagegi
const FIELD =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-slate-50 disabled:text-slate-500';

/**
 * Label + input ka jod. `hint` chhoti madad wali line.
 * useId() se unique id banti hai → <label htmlFor> input se jud jaata hai
 * (label click = input focus; screen reader sahi naam padhta hai — accessibility).
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': hint ? hintId : undefined,
      })
    : children;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${FIELD} ${props.className ?? 'w-full'}`} />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${FIELD} ${props.className ?? 'w-full'}`} />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${FIELD} ${props.className ?? 'w-full'}`}
    />
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="animate-fade-in rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
