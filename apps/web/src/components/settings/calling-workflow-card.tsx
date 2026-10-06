'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { CallingWorkflowConfig } from '@/lib/types';

const FIELDS: {
  key: keyof CallingWorkflowConfig;
  label: string;
  hint: string;
  min: number;
}[] = [
  {
    key: 'incompleteFormMinutes',
    label: 'Form pending reminder (minutes)',
    hint: 'Customer open this long without a saved form → one reminder to the assistant',
    min: 1,
  },
  {
    key: 'autoReleaseMinutes',
    label: 'Auto-release when away (minutes)',
    hint: 'Open this long AND assistant on break / offline → customer goes back to the queue. 0 = off',
    min: 0,
  },
];

/** Phase 10 (ADR 0015): "Save & Next" ke baad shift khatam → customer atka na rahe */
export function CallingWorkflowCard({
  initial,
  onSaved,
}: {
  initial: CallingWorkflowConfig;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api('/call-config/calling-workflow', {
        method: 'PUT',
        body: value,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Input
              type="number"
              min={f.min}
              value={value[f.key]}
              onChange={(e) => {
                setValue({ ...value, [f.key]: Number(e.target.value) });
                setSaved(false);
              }}
            />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save calling workflow'}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
      <div className="mt-3">
        <ErrorMessage message={error} />
      </div>
    </div>
  );
}
