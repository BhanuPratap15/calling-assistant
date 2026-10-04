'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input, Select } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import { PRIORITIES, type Category, type Tag } from '@/lib/types';
import { useApi } from '@/lib/use-api';

interface AddResult {
  matched: number;
  added: number;
  skipped: number;
}

/**
 * Filter se customers add karo ("saare High interest", "tag = Big Spender", "kabhi call nahi hua").
 * Sirf ACTIVE customers aate hain; jo pehle se campaign me hain wo skip.
 */
export function AddCustomersModal({
  campaignId,
  onClose,
  onDone,
}: {
  campaignId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const categories = useApi<Category[]>('/categories');
  const tags = useApi<Tag[]>('/tags');
  const [filter, setFilter] = useState({
    categoryId: '',
    tagId: '',
    priority: '',
    search: '',
    neverCalled: false,
  });
  const [result, setResult] = useState<AddResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const noFilter =
    !filter.categoryId &&
    !filter.tagId &&
    !filter.priority &&
    !filter.search.trim() &&
    !filter.neverCalled;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Galti se "sab 20,000 customers" na chale jaayein
    if (
      noFilter &&
      !window.confirm(
        'Koi filter nahi — SAARE active customers add honge. Pakka?',
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const r = await api<AddResult>(`/campaigns/${campaignId}/customers`, {
        method: 'POST',
        body: {
          filter: {
            categoryId: filter.categoryId || undefined,
            tagId: filter.tagId || undefined,
            priority: filter.priority || undefined,
            search: filter.search.trim() || undefined,
            neverCalled: filter.neverCalled || undefined,
          },
        },
      });
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <Modal title="Customers added" onClose={onDone}>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">Matched</dt>
            <dd className="text-xl font-semibold">{result.matched}</dd>
          </div>
          <div className="rounded-md bg-green-50 p-3">
            <dt className="text-xs text-green-700">Added</dt>
            <dd className="text-xl font-semibold text-green-800">
              {result.added}
            </dd>
          </div>
          <div className="rounded-md bg-amber-50 p-3">
            <dt className="text-xs text-amber-700">Already in campaign</dt>
            <dd className="text-xl font-semibold text-amber-800">
              {result.skipped}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex justify-end">
          <Button onClick={onDone}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add customers" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Jo customers in <b>sab</b> filters se match karenge (aur ACTIVE hain)
          wo add honge.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interest category">
            <Select
              value={filter.categoryId}
              onChange={(e) =>
                setFilter({ ...filter, categoryId: e.target.value })
              }
            >
              <option value="">Any</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value="none">Not rated yet</option>
            </Select>
          </Field>
          <Field label="Tag">
            <Select
              value={filter.tagId}
              onChange={(e) => setFilter({ ...filter, tagId: e.target.value })}
            >
              <option value="">Any</option>
              {tags.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={filter.priority}
              onChange={(e) =>
                setFilter({ ...filter, priority: e.target.value })
              }
            >
              <option value="">Any</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Name contains">
            <Input
              placeholder="e.g. Sharma"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filter.neverCalled}
            onChange={(e) =>
              setFilter({ ...filter, neverCalled: e.target.checked })
            }
          />
          Sirf fresh leads (jinko kabhi call nahi hua)
        </label>
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add matching customers'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
