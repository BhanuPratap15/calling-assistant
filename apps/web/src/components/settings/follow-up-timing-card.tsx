'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { FollowUpTimingConfig } from '@/lib/types';

const FIELDS: {
  key: keyof FollowUpTimingConfig;
  label: string;
  hint: string;
}[] = [
  {
    key: 'reminderMinutesBefore',
    label: 'Reminder (minutes before due)',
    hint: 'e.g. 1 → 3:59 PM pe reminder',
  },
  {
    key: 'gracePeriodMinutes',
    label: 'Grace period (minutes)',
    hint: 'Due ke baad itna intezaar, phir escalate / overdue alert',
  },
  {
    key: 'presenceTimeoutMinutes',
    label: 'Away after (minutes)',
    hint: 'Itni der koi activity nahi → assistant "away" (browser band)',
  },
];

export function FollowUpTimingCard({
  initial,
  onSaved,
}: {
  initial: FollowUpTimingConfig;
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
      await api('/call-config/follow-up-timing', {
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
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Input
              type="number"
              min={0}
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
          {saving ? 'Saving…' : 'Save follow-up timing'}
        </Button>
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
      <div className="mt-3">
        <ErrorMessage message={error} />
      </div>
    </div>
  );
}
