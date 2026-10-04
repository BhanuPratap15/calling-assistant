'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { ROLE_LABELS, type AssignableStaff } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Assign (naya) ya Reassign (existing open assignment ko kisi aur ko).
 *   reassignId diya → POST /assignments/:id/reassign, warna POST /assignments
 */
export function AssignModal({
  customer,
  reassignId,
  currentStaffId,
  onClose,
  onDone,
}: {
  customer: {
    id: string;
    name: string;
    // Profile se aata hai: customer jin campaigns me hai (call us campaign ke under hogi)
    campaigns?: { campaign: { id: string; name: string; status: string } }[];
  };
  reassignId?: string;
  currentStaffId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const staff = useApi<AssignableStaff[]>('/assignments/assignable-staff');
  const [staffId, setStaffId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const campaigns = (customer.campaigns ?? [])
    .map((c) => c.campaign)
    .filter((c) => c.status !== 'COMPLETED');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (reassignId) {
        await api(`/assignments/${reassignId}/reassign`, {
          method: 'POST',
          body: { staffId },
        });
      } else {
        await api('/assignments', {
          method: 'POST',
          body: {
            customerId: customer.id,
            staffId,
            campaignId: campaignId || undefined,
          },
        });
      }
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`${reassignId ? 'Reassign' : 'Assign'} — ${customer.name}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Assign to"
          hint="Ye customer us assistant ki queue me sabse aage jaayega"
        >
          <Select
            required
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">— Select staff —</option>
            {staff.data
              ?.filter((s) => s.id !== currentStaffId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {ROLE_LABELS[s.role]}
                  {s.team ? ` · ${s.team.name}` : ''} ·{' '}
                  {humanize(s.availability)}
                </option>
              ))}
          </Select>
        </Field>
        {!reassignId && campaigns.length > 0 && (
          <Field
            label="Campaign (optional)"
            hint="Chuna to assistant ko us campaign ka script + fields dikhenge"
          >
            <Select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">— No campaign —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <ErrorMessage message={error ?? staff.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !staffId}>
            {saving ? 'Saving…' : reassignId ? 'Reassign' : 'Assign'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
