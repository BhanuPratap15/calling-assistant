'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { Availability } from '@/lib/types';

const OPTIONS: { value: Availability; label: string; dot: string }[] = [
  { value: 'AVAILABLE', label: 'Available', dot: 'bg-green-500' },
  { value: 'ON_CALL', label: 'On Call', dot: 'bg-sky-500' },
  { value: 'BREAK', label: 'Break', dot: 'bg-amber-500' },
  { value: 'OFFLINE', label: 'Offline', dot: 'bg-slate-400' },
];

/**
 * Assistant ka status (design doc 8.2). ON_CALL system set karta hai (customer khulte hi),
 * isliye dropdown me disabled. BREAK/OFFLINE pe due follow-ups grace ke baad escalate ho sakte hain.
 */
export function AvailabilitySelect({ initial }: { initial: Availability }) {
  const [value, setValue] = useState<Availability>(initial);
  const [saving, setSaving] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[3];

  async function change(next: Availability) {
    const prev = value;
    setValue(next); // optimistic update — turant dikhe, fail ho to wapas
    setSaving(true);
    try {
      await api('/auth/availability', {
        method: 'PATCH',
        body: { availability: next },
      });
    } catch {
      setValue(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <span className={`h-2.5 w-2.5 rounded-full ${current.dot}`} aria-hidden />
      <span className="sr-only">Availability</span>
      <select
        aria-label="Availability"
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value as Availability)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      >
        {OPTIONS.map((o) => (
          <option
            key={o.value}
            value={o.value}
            disabled={o.value === 'ON_CALL'}
          >
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
