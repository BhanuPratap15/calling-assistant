'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import type { CampaignDetail } from '@/lib/types';

/** ISO → <input type="datetime-local"> value (local time, "2026-10-04T16:00") */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Naya campaign ya details edit (status alag buttons se badalta hai) */
export function CampaignFormModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign?: CampaignDetail;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isEdit = Boolean(campaign);
  const [form, setForm] = useState({
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
    priority: String(campaign?.priority ?? 0),
    script: campaign?.script ?? '',
    startsAt: toLocalInput(campaign?.startsAt),
    endsAt: toLocalInput(campaign?.endsAt),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
    try {
      const body = {
        name: form.name,
        description: form.description,
        priority: Number(form.priority),
        script: form.script,
        // Edit: khaali = date hatao (null). Create: khaali = bhejo hi mat.
        startsAt: toIso(form.startsAt) ?? (isEdit ? null : undefined),
        endsAt: toIso(form.endsAt) ?? (isEdit ? null : undefined),
      };
      const saved = await api<{ id: string }>(
        isEdit ? `/campaigns/${campaign!.id}` : '/campaigns',
        {
          method: isEdit ? 'PATCH' : 'POST',
          body: isEdit
            ? body
            : {
                ...body,
                description: body.description || undefined,
                script: body.script || undefined,
              },
        },
      );
      onSaved(saved.id);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? `Edit ${campaign?.name}` : 'New campaign'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Campaign name">
          <Input
            required
            maxLength={100}
            placeholder="e.g. Diwali Bonus Offer"
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
          />
        </Field>
        <Field label="Description (optional)">
          <Textarea
            rows={2}
            maxLength={1000}
            value={form.description}
            onChange={(e) => set('description')(e.target.value)}
          />
        </Field>
        <Field
          label="Priority (0–100)"
          hint="Do campaigns chalu hon to bada number pehle call hota hai"
        >
          <Input
            type="number"
            min={0}
            max={100}
            required
            value={form.priority}
            onChange={(e) => set('priority')(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (optional)">
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => set('startsAt')(e.target.value)}
            />
          </Field>
          <Field label="Ends (optional)">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => set('endsAt')(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Call script (optional)"
          hint="Calling screen pe assistant ko dikhega — kya bolna hai"
        >
          <Textarea
            rows={5}
            maxLength={5000}
            placeholder="Namaste {naam} ji, main ... se bol raha hoon. Is Diwali ..."
            value={form.script}
            onChange={(e) => set('script')(e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
