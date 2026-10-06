'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Tag, TagRef } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Customer ke tags: chips + (permission ho to) "Edit tags" → checkbox list → Save.
 * Backend: PUT /customers/:id/tags (poori list replace).
 */
export function TagEditor({
  customerId,
  tags,
  canEdit,
  onSaved,
}: {
  customerId: string;
  tags: TagRef[];
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const all = useApi<Tag[]>(editing ? '/tags' : null); // list sirf edit pe load
  const [selected, setSelected] = useState<string[]>(tags.map((t) => t.id));
  const [current, setCurrent] = useState<TagRef[]>(tags);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/customers/${customerId}/tags`, {
        method: 'PUT',
        body: { tagIds: selected },
      });
      setCurrent((all.data ?? []).filter((t) => selected.includes(t.id)));
      setEditing(false);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {current.length === 0 && !editing && (
          <span className="text-xs text-slate-400">No tags</span>
        )}
        {current.map((t) => (
          <Badge key={t.id} tone={t.color}>
            {t.name}
          </Badge>
        ))}
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Edit tags
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          {all.loading && <p className="text-xs text-slate-400">Loading…</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {all.data
              ?.filter((t) => t.isActive || selected.includes(t.id))
              .map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-1.5 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  {t.name}
                </label>
              ))}
            {all.data?.length === 0 && (
              <p className="text-xs text-slate-500">
                No tags yet — a manager can create them in Settings.
              </p>
            )}
          </div>
          <ErrorMessage message={error} />
          <div className="mt-3 flex gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save tags'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(current.map((t) => t.id));
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
