'use client';

import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Input, Select } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Tag, Tone } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const COLORS: Tone[] = ['gray', 'blue', 'green', 'yellow', 'red', 'indigo'];

/** Tags: banao, rang badlo, band karo (delete nahi — customers pe lage rehte hain) */
export function TagsCard() {
  const tags = useApi<Tag[]>('/tags');
  const [name, setName] = useState('');
  const [color, setColor] = useState<Tone>('blue');
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/tags', { method: 'POST', body: { name, color } });
      setName('');
      tags.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function patch(tag: Tag, body: Partial<Tag>) {
    setError(null);
    try {
      await api(`/tags/${tag.id}`, { method: 'PATCH', body });
      tags.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <form onSubmit={create} className="mb-4 flex flex-wrap gap-2">
        <Input
          aria-label="New tag name"
          placeholder="e.g. Big Spender, Callback Requested"
          className="w-72"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          aria-label="New tag color"
          className="w-28"
          value={color}
          onChange={(e) => setColor(e.target.value as Tone)}
        >
          {COLORS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Button type="submit">+ Add tag</Button>
      </form>
      <ErrorMessage message={error ?? tags.error} />
      <ul className="divide-y divide-slate-100">
        {tags.data?.length === 0 && (
          <li className="py-2 text-sm text-slate-400">No tags yet</li>
        )}
        {tags.data?.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
            <Badge tone={t.color}>{t.name}</Badge>
            <span className="text-xs text-slate-400">
              {t._count?.customers ?? 0} customers
            </span>
            {!t.isActive && (
              <span className="text-xs text-slate-400">(inactive)</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Select
                aria-label={`Color of ${t.name}`}
                className="w-24"
                value={t.color}
                onChange={(e) => patch(t, { color: e.target.value as Tone })}
              >
                {COLORS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Button
                variant="ghost"
                onClick={() => patch(t, { isActive: !t.isActive })}
              >
                {t.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
