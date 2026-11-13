'use client';

import { Field, Input } from '@/components/ui/form';
import { DIALER_MODES, type DialerMode } from '@/lib/platform';

/** Brochure ka "Option A / Option B": hamara dialer ya client ka apna */
export function DialerFields({
  value,
  onChange,
}: {
  value: { dialerMode: DialerMode; externalDialerUrl: string };
  onChange: (
    patch: Partial<{ dialerMode: DialerMode; externalDialerUrl: string }>,
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3">
        {(Object.keys(DIALER_MODES) as DialerMode[]).map((mode) => {
          const selected = value.dialerMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ dialerMode: mode })}
              className={`rounded-xl border p-3 text-left ${selected ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <p
                className={`text-sm font-medium ${selected ? 'text-indigo-800' : 'text-slate-900'}`}
              >
                {DIALER_MODES[mode].label}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {DIALER_MODES[mode].description}
              </p>
            </button>
          );
        })}
      </div>
      {value.dialerMode === 'EXTERNAL_PANEL' && (
        <Field
          label="Dialer panel link"
          hint="https:// link of the client's dialer website — shown next to the copied number"
        >
          <Input
            type="url"
            required
            placeholder="https://dialer.clientcompany.com"
            value={value.externalDialerUrl}
            onChange={(e) => onChange({ externalDialerUrl: e.target.value })}
          />
        </Field>
      )}
    </div>
  );
}
