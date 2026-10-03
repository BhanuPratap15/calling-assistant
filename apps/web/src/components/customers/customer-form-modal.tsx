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
import { humanize } from '@/lib/format';
import {
  CUSTOMER_STATUSES,
  PRIORITIES,
  type Customer,
  type CustomerStatus,
  type Priority,
} from '@/lib/types';

export function CustomerFormModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(customer);
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    alternatePhone: customer?.alternatePhone ?? '',
    email: customer?.email ?? '',
    externalId: customer?.externalId ?? '',
    priority: customer?.priority ?? ('NORMAL' as Priority),
    status: customer?.status ?? ('ACTIVE' as CustomerStatus),
    notes: customer?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Khaali optional fields mat bhejo (backend validation "" ko galat email maanega)
    const body = {
      name: form.name,
      phone: form.phone,
      alternatePhone: form.alternatePhone || undefined,
      email: form.email || undefined,
      externalId: form.externalId || undefined,
      priority: form.priority,
      status: form.status,
      notes: form.notes || undefined,
    };
    try {
      await api(isEdit ? `/customers/${customer!.id}` : '/customers', {
        method: isEdit ? 'PATCH' : 'POST',
        body,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit ${customer?.name}` : 'Add customer'}
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone" hint="Kisi bhi format me — +91 apne aap">
            <Input
              required
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Alternate phone">
            <Input
              value={form.alternatePhone}
              onChange={(e) => set('alternatePhone', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
          <Field label="External ID" hint="Casino platform user ID">
            <Input
              value={form.externalId}
              onChange={(e) => set('externalId', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => set('status', e.target.value as CustomerStatus)}
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
