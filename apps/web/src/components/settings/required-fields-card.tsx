'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Select } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { RequiredFieldsConfig, RequiredRule } from '@/lib/types';

const FIELDS: { key: keyof RequiredFieldsConfig; label: string }[] = [
  { key: 'userResponse', label: 'User Response' },
  { key: 'notes', label: 'Conversation Notes' },
  { key: 'interestRating', label: 'Interest Rating (0–10)' },
];

const RULE_LABELS: Record<RequiredRule, string> = {
  always: 'Always required',
  connected: 'Required only when connected',
  optional: 'Optional',
};

export function RequiredFieldsCard({
  initial,
  onSaved,
}: {
  initial: RequiredFieldsConfig;
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
      await api('/call-config/required-fields', { method: 'PUT', body: value });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card p-5">
      <p className="mb-4 text-sm text-slate-500">
        Call Outcome and Next Action are always required. Follow-up date/time is
        required when the Next Action needs a follow-up.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Select
              value={value[f.key]}
              onChange={(e) => {
                setValue({ ...value, [f.key]: e.target.value as RequiredRule });
                setSaved(false);
              }}
            >
              {(Object.keys(RULE_LABELS) as RequiredRule[]).map((r) => (
                <option key={r} value={r}>
                  {RULE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save required fields'}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
      <div className="mt-3">
        <ErrorMessage message={error} />
      </div>
    </div>
  );
}
