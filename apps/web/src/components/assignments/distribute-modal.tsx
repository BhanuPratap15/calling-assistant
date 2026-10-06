'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import {
  PRIORITIES,
  ROLE_LABELS,
  type AssignableStaff,
  type Campaign,
  type Category,
  type Tag,
} from '@/lib/types';
import { useApi } from '@/lib/use-api';

type Strategy = 'LOAD_BASED' | 'ROUND_ROBIN';

interface DistributeResult {
  strategy: Strategy;
  dryRun: boolean;
  eligible: number;
  assigned: number;
  perStaff: {
    staffId: string;
    name: string;
    currentLoad: number;
    newCount: number;
  }[];
}

const STRATEGIES: { value: Strategy; label: string; hint: string }[] = [
  {
    value: 'LOAD_BASED',
    label: 'Load-based',
    hint: 'Jiske paas kam kaam, use zyada — aakhir me sab barabar',
  },
  {
    value: 'ROUND_ROBIN',
    label: 'Round-robin',
    hint: 'Baari baari — sabko barabar naye customers',
  },
];

/**
 * Bulk distribute (design doc section 9, ADR 0015): customers chuno → assistants chuno →
 * Preview (kisko kitne, kuch save nahi) → Confirm. Manager: sab; TL: sirf apni team.
 */
export function DistributeModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (r: DistributeResult) => void;
}) {
  const staff = useApi<AssignableStaff[]>('/assignments/assignable-staff');
  const campaigns = useApi<Campaign[]>('/campaigns');
  const categories = useApi<Category[]>('/categories');
  const tags = useApi<Tag[]>('/tags');
  const [selected, setSelected] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('LOAD_BASED');
  const [form, setForm] = useState({
    campaignId: '',
    categoryId: '',
    tagId: '',
    priority: '',
    onlyFresh: true,
    limit: 100,
    perStaffLimit: '',
  });
  const [preview, setPreview] = useState<DistributeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setPreview(null); // kuch badla → purana preview galat
  };
  const toggle = (id: string) => {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
    setPreview(null);
  };
  const assistants = (staff.data ?? []).filter((s) => s.role === 'ASSISTANT');

  async function run(dryRun: boolean) {
    setError(null);
    if (!selected.length) {
      setError('Kam se kam ek assistant chuniye');
      return;
    }
    setBusy(true);
    try {
      const r = await api<DistributeResult>('/assignments/distribute', {
        method: 'POST',
        body: {
          staffIds: selected,
          strategy,
          limit: form.limit,
          perStaffLimit: form.perStaffLimit
            ? Number(form.perStaffLimit)
            : undefined,
          campaignId: form.campaignId || undefined,
          categoryId: form.categoryId || undefined,
          tagId: form.tagId || undefined,
          priority: form.priority || undefined,
          onlyFresh: form.onlyFresh,
          dryRun,
        },
      });
      if (dryRun) setPreview(r);
      else onDone(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Distribute customers" onClose={onClose}>
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">
            Kisko? ({selected.length} selected)
          </legend>
          <div className="mb-1 flex gap-3 text-xs">
            <button
              type="button"
              className="text-indigo-700 hover:underline"
              onClick={() => {
                setSelected(assistants.map((s) => s.id));
                setPreview(null);
              }}
            >
              Select all assistants
            </button>
            <button
              type="button"
              className="text-slate-500 hover:underline"
              onClick={() => {
                setSelected([]);
                setPreview(null);
              }}
            >
              Clear
            </button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {(staff.data ?? []).map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                />
                {s.name}
                <span className="text-xs text-slate-500">
                  {ROLE_LABELS[s.role]}
                  {s.team ? ` · ${s.team.name}` : ''} ·{' '}
                  {humanize(s.availability)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">
            Kaise baantein?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {STRATEGIES.map((s) => (
              <label
                key={s.value}
                className={`cursor-pointer rounded-md border p-2 text-sm ${strategy === s.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
              >
                <input
                  type="radio"
                  name="strategy"
                  className="mr-2"
                  checked={strategy === s.value}
                  onChange={() => {
                    setStrategy(s.value);
                    setPreview(null);
                  }}
                />
                <b>{s.label}</b>
                <span className="block text-xs text-slate-500">{s.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Campaign (optional)"
            hint="Diya → us campaign ke abhi tak na call hue customers"
          >
            <Select
              value={form.campaignId}
              onChange={(e) => change({ campaignId: e.target.value })}
            >
              <option value="">— No campaign (general pool) —</option>
              {(campaigns.data ?? [])
                .filter((c) => c.status !== 'COMPLETED')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({humanize(c.status)})
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Interest category">
            <Select
              value={form.categoryId}
              onChange={(e) => change({ categoryId: e.target.value })}
            >
              <option value="">Any</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tag">
            <Select
              value={form.tagId}
              onChange={(e) => change({ tagId: e.target.value })}
            >
              <option value="">Any</option>
              {(tags.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => change({ priority: e.target.value })}
            >
              <option value="">Any</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How many customers (max 2000)">
            <Input
              type="number"
              min={1}
              max={2000}
              value={form.limit}
              onChange={(e) => change({ limit: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max per assistant (optional)">
            <Input
              type="number"
              min={1}
              value={form.perStaffLimit}
              onChange={(e) => change({ perStaffLimit: e.target.value })}
            />
          </Field>
        </div>
        {!form.campaignId && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.onlyFresh}
              onChange={(e) => change({ onlyFresh: e.target.checked })}
            />
            Sirf fresh leads (kabhi call nahi hue)
          </label>
        )}

        {preview && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="mb-2 font-medium">
              Preview: {preview.assigned} of {preview.eligible} eligible
              customers
            </p>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1">Assistant</th>
                  <th className="py-1 text-right">Open now</th>
                  <th className="py-1 text-right">+ New</th>
                  <th className="py-1 text-right">After</th>
                </tr>
              </thead>
              <tbody>
                {preview.perStaff.map((p) => (
                  <tr key={p.staffId} className="border-t border-slate-200">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-right tabular-nums">
                      {p.currentLoad}
                    </td>
                    <td className="py-1 text-right font-semibold tabular-nums">
                      +{p.newCount}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {p.currentLoad + p.newCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.eligible === 0 && (
              <p className="mt-2 text-amber-800">
                Koi eligible customer nahi — filters badal ke dekhiye.
              </p>
            )}
          </div>
        )}

        <ErrorMessage message={error ?? staff.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => run(true)} disabled={busy}>
            Preview
          </Button>
          <Button
            onClick={() => run(false)}
            disabled={busy || !preview || preview.assigned === 0}
            title={!preview ? 'Pehle Preview dekhiye' : undefined}
          >
            {busy
              ? 'Working…'
              : `Distribute ${preview ? preview.assigned : ''} →`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
