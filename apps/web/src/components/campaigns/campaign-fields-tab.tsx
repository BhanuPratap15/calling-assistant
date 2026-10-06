'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { Table, Td } from '@/components/ui/table';
import { api } from '@/lib/api';
import { humanize } from '@/lib/format';
import {
  CAMPAIGN_FIELD_TYPES,
  type CampaignField,
  type CampaignFieldType,
} from '@/lib/types';

interface Row {
  id?: string; // saved field; naye row me nahi
  key: string;
  label: string;
  type: CampaignFieldType;
  optionsText: string; // "Yes, No, Maybe"
  required: boolean;
  isActive: boolean;
  keyTouched: boolean; // naye row me key label se auto banti hai jab tak user khud na badle
}

const KEY_RULE = /^[a-z][a-z0-9_]{0,39}$/;

/** "Deposit Amount (₹)" → "deposit_amount" */
function toKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+|_+$/g, '')
    .slice(0, 40);
}

function toRow(f: CampaignField): Row {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    optionsText: f.options.join(', '),
    required: f.required,
    isActive: f.isActive,
    keyTouched: true,
  };
}

/**
 * Campaign ke extra call-form fields (design doc section 11: "custom fields").
 * Key + type save ke baad fix (purani calls ka data isi key se hai) — field band karna ho to "Active" hatao.
 */
export function CampaignFieldsTab({
  campaignId,
  fields,
  canEdit,
  onSaved,
}: {
  campaignId: string;
  fields: CampaignField[];
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => fields.map(toRow));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Row>) => {
    setSaved(false);
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (!r.id && !next.keyTouched && patch.label !== undefined)
          next.key = toKey(patch.label);
        return next;
      }),
    );
  };

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        key: '',
        label: '',
        type: 'TEXT',
        optionsText: '',
        required: false,
        isActive: true,
        keyTouched: false,
      },
    ]);

  function validate(): string[] {
    const problems: string[] = [];
    const keys = new Set<string>();
    rows.forEach((r, i) => {
      const name = r.label.trim() || `Row ${i + 1}`;
      if (!r.label.trim()) problems.push(`Row ${i + 1}: label is required`);
      if (!KEY_RULE.test(r.key))
        problems.push(`${name}: key must be snake_case (e.g. deposit_amount)`);
      if (keys.has(r.key))
        problems.push(`${name}: key "${r.key}" is used twice`);
      keys.add(r.key);
      if (r.type === 'SELECT' && !splitOptions(r.optionsText).length)
        problems.push(`${name}: add dropdown options (comma separated)`);
    });
    return problems;
  }

  async function save() {
    const problems = validate();
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      const saved = await api<CampaignField[]>(
        `/campaigns/${campaignId}/fields`,
        {
          method: 'PUT',
          // Sirf API wale fields bhejo (keyTouched / optionsText nahi — warna 400)
          body: {
            fields: rows.map((r, i) => ({
              id: r.id,
              key: r.key,
              label: r.label.trim(),
              type: r.type,
              options: r.type === 'SELECT' ? splitOptions(r.optionsText) : [],
              required: r.required,
              isActive: r.isActive,
              sortOrder: (i + 1) * 10,
            })),
          },
        },
      );
      setRows(saved.map(toRow));
      setSaved(true);
      onSaved();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <Table
        headers={['Field', 'Key', 'Type', 'Required', 'Active']}
        empty={!fields.length}
      >
        {fields.map((f) => (
          <tr key={f.id}>
            <Td>{f.label}</Td>
            <Td className="font-mono text-xs">{f.key}</Td>
            <Td>
              {humanize(f.type)}
              {f.type === 'SELECT' && (
                <p className="text-xs text-slate-400">{f.options.join(', ')}</p>
              )}
            </Td>
            <Td>{f.required ? 'Yes' : 'No'}</Td>
            <Td>
              {f.isActive ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge>Off</Badge>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
        These fields appear as extra inputs on every call form in this campaign
        (e.g. &quot;Deposit amount&quot;, &quot;Bonus accepted?&quot;). Key and
        type cannot be changed after saving — to retire a field, untick
        <b>Active</b>.
      </p>
      <Table
        headers={[
          'Label',
          'Key',
          'Type',
          'Options (dropdown)',
          'Required',
          'Active',
          '',
        ]}
        empty={!rows.length}
      >
        {rows.map((r, i) => (
          <tr key={r.id ?? `new-${i}`}>
            <Td>
              <Input
                aria-label={`Field ${i + 1} label`}
                className="w-44"
                maxLength={60}
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </Td>
            <Td>
              <Input
                aria-label={`Field ${i + 1} key`}
                className="w-40 font-mono"
                disabled={Boolean(r.id)}
                value={r.key}
                onChange={(e) =>
                  update(i, { key: e.target.value, keyTouched: true })
                }
              />
            </Td>
            <Td>
              <Select
                aria-label={`Field ${i + 1} type`}
                className="w-32"
                disabled={Boolean(r.id)}
                value={r.type}
                onChange={(e) =>
                  update(i, { type: e.target.value as CampaignFieldType })
                }
              >
                {CAMPAIGN_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t === 'SELECT'
                      ? 'Dropdown'
                      : t === 'BOOLEAN'
                        ? 'Yes / No'
                        : humanize(t)}
                  </option>
                ))}
              </Select>
            </Td>
            <Td>
              {r.type === 'SELECT' ? (
                <Input
                  aria-label={`Field ${i + 1} options`}
                  className="w-52"
                  placeholder="Gold, Silver, Bronze"
                  value={r.optionsText}
                  onChange={(e) => update(i, { optionsText: e.target.value })}
                />
              ) : (
                <span className="text-slate-300">—</span>
              )}
            </Td>
            <Td>
              <input
                type="checkbox"
                aria-label={`Field ${i + 1} required`}
                checked={r.required}
                onChange={(e) => update(i, { required: e.target.checked })}
              />
            </Td>
            <Td>
              <input
                type="checkbox"
                aria-label={`Field ${i + 1} active`}
                checked={r.isActive}
                onChange={(e) => update(i, { isActive: e.target.checked })}
              />
            </Td>
            <Td>
              {!r.id && (
                <Button
                  variant="ghost"
                  aria-label={`Remove field ${i + 1}`}
                  onClick={() =>
                    setRows((rs) => rs.filter((_, idx) => idx !== i))
                  }
                >
                  ✕
                </Button>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      {errors.length > 0 && (
        <ul
          role="alert"
          className="list-inside list-disc rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={addRow}>
          + Add field
        </Button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-700">Saved ✓</span>}
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save fields'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function splitOptions(text: string): string[] {
  return text
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
