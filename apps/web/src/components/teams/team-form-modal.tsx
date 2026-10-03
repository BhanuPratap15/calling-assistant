'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  ErrorMessage,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import type { Staff, Team } from '@/lib/types';

export function TeamFormModal({
  team,
  leaders,
  onClose,
  onSaved,
}: {
  team?: Team;
  leaders: Staff[]; // active TEAM_LEADERs
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(team);
  const [form, setForm] = useState({
    name: team?.name ?? '',
    description: team?.description ?? '',
    leaderId: team?.leader?.id ?? '',
    isActive: team?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && team) {
        await api(`/teams/${team.id}`, {
          method: 'PATCH',
          body: {
            name: form.name,
            description: form.description,
            leaderId: form.leaderId || null,
            isActive: form.isActive,
          },
        });
      } else {
        await api('/teams', {
          method: 'POST',
          body: {
            name: form.name,
            description: form.description || undefined,
            leaderId: form.leaderId || undefined,
          },
        });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${team?.name}` : 'New team'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Team name">
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Description (optional)">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field
          label="Team Leader"
          hint="Sirf active Team Leader role wale staff"
        >
          <Select
            value={form.leaderId}
            onChange={(e) => setForm({ ...form, leaderId: e.target.value })}
          >
            <option value="">— No leader —</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.email})
              </option>
            ))}
          </Select>
        </Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        )}
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create team'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
