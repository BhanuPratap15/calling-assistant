'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { manageableRoles } from '@/lib/permissions';
import {
  ROLE_LABELS,
  type Staff,
  type StaffRole,
  type Team,
} from '@/lib/types';

/**
 * Ek hi form create aur edit dono ke liye.
 *   staff = undefined → naya banao (POST)
 *   staff = {...}     → edit (PATCH, sirf badle hue fields)
 */
export function StaffFormModal({
  staff,
  actorRole,
  teams,
  onClose,
  onSaved,
}: {
  staff?: Staff;
  actorRole: StaffRole;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(staff);
  const [form, setForm] = useState({
    name: staff?.name ?? '',
    email: staff?.email ?? '',
    phone: staff?.phone ?? '',
    password: '',
    role: staff?.role ?? ('ASSISTANT' as StaffRole),
    teamId: staff?.teamId ?? '',
    isActive: staff?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ek helper: kisi bhi field ko update karo
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit && staff) {
        await api(`/staff/${staff.id}`, {
          method: 'PATCH',
          body: {
            name: form.name,
            phone: form.phone || undefined,
            role: form.role !== staff.role ? form.role : undefined,
            teamId: form.teamId || null,
            isActive:
              form.isActive !== staff.isActive ? form.isActive : undefined,
          },
        });
      } else {
        await api('/staff', {
          method: 'POST',
          body: {
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            password: form.password,
            role: form.role,
            teamId: form.teamId || undefined,
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
    <Modal
      title={isEdit ? `Edit ${staff?.name}` : 'Add staff'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <Input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field
          label="Email"
          hint={isEdit ? 'Email badla nahi ja sakta' : undefined}
        >
          <Input
            type="email"
            required
            disabled={isEdit}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="Phone (optional)">
          <Input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        {!isEdit && (
          <Field
            label="Initial password"
            hint="8+ characters, kam se kam 1 letter aur 1 number"
          >
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Role">
            <Select
              value={form.role}
              onChange={(e) => set('role', e.target.value as StaffRole)}
            >
              {manageableRoles(actorRole).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Team">
            <Select
              value={form.teamId}
              onChange={(e) => set('teamId', e.target.value)}
            >
              <option value="">— No team —</option>
              {teams
                .filter((t) => t.isActive)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Active (uncheck = deactivate, login band)
          </label>
        )}

        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
