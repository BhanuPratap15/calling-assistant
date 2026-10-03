'use client';

import { useState } from 'react';
import { CategoryBadge } from '@/components/categories/category-badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import {
  PRIORITIES,
  type Category,
  type Priority,
  type Tone,
} from '@/lib/types';

const COLORS: Tone[] = ['gray', 'blue', 'green', 'yellow', 'red', 'indigo'];
const CELL = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

type Row = Omit<Category, 'id'> & { id?: string };

/**
 * Sirf wahi fields bhejo jo API leti hai — server se aaye createdAt/updatedAt waghera nahi
 * (backend "forbidNonWhitelisted": extra field = 400).
 */
const toInput = ({
  id,
  code,
  label,
  minRating,
  maxRating,
  color,
  priority,
  isActive,
  sortOrder,
}: Row) => ({
  id,
  code,
  label,
  minRating,
  maxRating,
  color,
  priority,
  isActive,
  sortOrder,
});

/**
 * Category thresholds (design doc section 10). Poora set ek saath save hota hai:
 * backend overlap check karta hai aur saare customers recalculate karta hai.
 */
export function CategoriesCard({
  initial,
  onSaved,
}: {
  initial: Category[];
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Row>) => {
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    );
    setResult(null);
  };

  function addRow() {
    setRows((r) => [
      ...r,
      {
        code: '',
        label: '',
        minRating: 0,
        maxRating: 0,
        color: 'gray',
        priority: null,
        isActive: true,
        sortOrder: (r.at(-1)?.sortOrder ?? 0) + 10,
      },
    ]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<{
        categories: Category[];
        recalculated: number;
        uncovered: number[];
      }>('/categories', {
        method: 'PUT',
        body: { categories: rows.map(toInput) },
      });
      setRows(res.categories);
      setResult(
        `Saved ✓ — ${res.recalculated} customers ki category badli` +
          (res.uncovered.length
            ? ` · ⚠ in ratings pe koi category nahi: ${res.uncovered.join(', ')}`
            : ''),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="mb-4 text-sm text-slate-500">
        Call me di gayi Interest Rating (0–10) se customer ki category apne aap
        set hoti hai. Range badalne pe <b>saare customers</b> recalculate honge.
        Priority: category me aate hi customer ki priority (blank = mat badlo).
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Preview</th>
              <th className="pr-2">Code</th>
              <th className="pr-2">Label</th>
              <th className="pr-2">Min</th>
              <th className="pr-2">Max</th>
              <th className="pr-2">Color</th>
              <th className="pr-2">Priority</th>
              <th className="pr-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id ?? `new-${i}`}
                className="border-t border-slate-100"
              >
                <td className="py-2 pr-2">
                  <CategoryBadge
                    category={{
                      id: row.id ?? '',
                      code: row.code,
                      label: row.label || '—',
                      color: row.color,
                    }}
                  />
                </td>
                <td className="pr-2">
                  <input
                    aria-label={`Code ${i + 1}`}
                    className={`${CELL} w-40 font-mono text-xs`}
                    value={row.code}
                    disabled={Boolean(row.id)}
                    onChange={(e) =>
                      update(i, {
                        code: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                      })
                    }
                  />
                </td>
                <td className="pr-2">
                  <input
                    aria-label={`Label ${i + 1}`}
                    className={`${CELL} w-36`}
                    value={row.label}
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </td>
                <td className="pr-2">
                  <input
                    aria-label={`Min rating ${row.code || i + 1}`}
                    type="number"
                    min={0}
                    max={10}
                    className={`${CELL} w-16`}
                    value={row.minRating}
                    onChange={(e) =>
                      update(i, { minRating: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="pr-2">
                  <input
                    aria-label={`Max rating ${row.code || i + 1}`}
                    type="number"
                    min={0}
                    max={10}
                    className={`${CELL} w-16`}
                    value={row.maxRating}
                    onChange={(e) =>
                      update(i, { maxRating: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="pr-2">
                  <select
                    aria-label={`Color ${i + 1}`}
                    className={CELL}
                    value={row.color}
                    onChange={(e) =>
                      update(i, { color: e.target.value as Tone })
                    }
                  >
                    {COLORS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="pr-2">
                  <select
                    aria-label={`Priority ${i + 1}`}
                    className={CELL}
                    value={row.priority ?? ''}
                    onChange={(e) =>
                      update(i, {
                        priority: (e.target.value || null) as Priority | null,
                      })
                    }
                  >
                    <option value="">—</option>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {humanize(p)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-2">
                  <input
                    aria-label={`Active ${i + 1}`}
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) => update(i, { isActive: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving & recalculating…' : 'Save categories'}
        </Button>
        <Button variant="secondary" onClick={addRow}>
          + Add category
        </Button>
        {result && <span className="text-sm text-green-700">{result}</span>}
      </div>
      <div className="mt-3">
        <ErrorMessage message={error} />
      </div>
    </div>
  );
}
