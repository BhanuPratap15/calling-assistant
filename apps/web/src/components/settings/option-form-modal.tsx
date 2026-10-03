'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';

/**
 * Call outcome aur next action — dono ka form ek jaisa hai, sirf ek checkbox alag:
 *   outcome     → isConnected       ("Customer se baat hui")
 *   next action → requiresFollowUp  ("Follow-up date/time zaroori")
 */
export interface OptionFormConfig {
  endpoint: '/call-config/outcomes' | '/call-config/next-actions';
  title: string; // "call outcome" / "next action"
  flagKey: 'isConnected' | 'requiresFollowUp';
  flagLabel: string;
}

interface OptionValue {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
  isConnected?: boolean;
  requiresFollowUp?: boolean;
}

export function OptionFormModal({
  config,
  option,
  onClose,
  onSaved,
}: {
  config: OptionFormConfig;
  option?: OptionValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(option);
  const [code, setCode] = useState(option?.code ?? '');
  const [label, setLabel] = useState(option?.label ?? '');
  const [sortOrder, setSortOrder] = useState(String(option?.sortOrder ?? 100));
  const [flag, setFlag] = useState(Boolean(option?.[config.flagKey]));
  const [isActive, setIsActive] = useState(option?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const common = {
      label,
      sortOrder: Number(sortOrder),
      [config.flagKey]: flag,
    };
    try {
      if (isEdit && option) {
        await api(`${config.endpoint}/${option.id}`, {
          method: 'PATCH',
          body: { ...common, isActive },
        });
      } else {
        await api(config.endpoint, {
          method: 'POST',
          body: { ...common, code },
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
      title={isEdit ? `Edit ${option?.label}` : `Add ${config.title}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Code"
          hint={
            isEdit
              ? 'Code badla nahi ja sakta (reports isi se)'
              : 'UPPER_SNAKE_CASE, e.g. CALLBACK_REQUESTED'
          }
        >
          <Input
            required
            disabled={isEdit}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))
            }
          />
        </Field>
        <Field label="Label" hint="Assistant ko dropdown me yahi dikhega">
          <Input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field label="Sort order" hint="Chhota number = list me upar">
          <Input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={flag}
            onChange={(e) => setFlag(e.target.checked)}
          />
          {config.flagLabel}
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (uncheck = assistants ke form se hat jaayega)
          </label>
        )}
        <ErrorMessage message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
