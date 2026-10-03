'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import type { AssignableStaff, FollowUp } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export function ReassignFollowUpModal({
  followUp,
  onClose,
  onDone,
}: {
  followUp: FollowUp;
  onClose: () => void;
  onDone: () => void;
}) {
  // Same scoped list jo assignments use karte hain (Manager → sab, TL → apni team)
  const staff = useApi<AssignableStaff[]>('/assignments/assignable-staff');
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/follow-ups/${followUp.id}/reassign`, {
        method: 'POST',
        body: { staffId },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Reassign follow-up — ${followUp.customer.name}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Give to">
          <Select
            required
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">— Select staff —</option>
            {staff.data
              ?.filter((s) => s.id !== followUp.owner.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {humanize(s.availability)}
                  {s.team ? ` · ${s.team.name}` : ''}
                </option>
              ))}
          </Select>
        </Field>
        <ErrorMessage message={error ?? staff.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !staffId}>
            {saving ? 'Saving…' : 'Reassign'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
