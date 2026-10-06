'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import type { FollowUp } from '@/lib/types';

/** Date → <input type="datetime-local"> ki local value ("2026-10-03T16:00") */
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RescheduleModal({
  followUp,
  onClose,
  onDone,
}: {
  followUp: FollowUp;
  onClose: () => void;
  onDone: () => void;
}) {
  // Default: purana time, ya (wo nikal gaya ho to) abhi se 15 min baad.
  // Function initializer → sirf pehli render pe chalta hai (render pure rehta hai)
  const [value, setValue] = useState(() =>
    toLocalInput(
      new Date(
        Math.max(new Date(followUp.dueAt).getTime(), Date.now() + 15 * 60_000),
      ),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/follow-ups/${followUp.id}/reschedule`, {
        method: 'POST',
        body: { dueAt: new Date(value).toISOString() },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Reschedule — ${followUp.customer.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="New date & time"
          hint="Reminder and due alerts will be sent again for the new time"
        >
          <Input
            type="datetime-local"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Reschedule'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
