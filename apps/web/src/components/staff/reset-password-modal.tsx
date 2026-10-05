'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import type { Staff } from '@/lib/types';

export function ResetPasswordModal({
  staff,
  onClose,
  onDone,
}: {
  staff: Staff;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/staff/${staff.id}/reset-password`, {
        method: 'POST',
        body: { newPassword: password },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title={`Reset password — ${staff.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="New password"
          hint="8+ characters, kam se kam 1 letter aur 1 number. Staff ke saare sessions logout honge; pehle login pe naya password banana hoga"
        >
          <Input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Reset password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
