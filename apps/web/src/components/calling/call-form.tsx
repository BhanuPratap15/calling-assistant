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
import {
  validateCustomFieldInputs,
  type CustomFieldInputs,
} from '@/lib/campaign';
import {
  isFieldRequired,
  validateCallForm,
  type CallFormState,
} from '@/lib/call-form';
import type { CallConfig, CampaignFieldDef } from '@/lib/types';

const EMPTY: CallFormState = {
  outcomeId: '',
  nextActionId: '',
  userResponse: '',
  notes: '',
  interestRating: null,
  followUpAt: '',
};

/**
 * Call form (design doc section 6). Kaunsa field zaroori hai — Settings ke rules
 * + chuna hua outcome (connected?) + next action (follow-up?) se LIVE decide hota hai.
 */
export function CallForm({
  config,
  campaignFields = [],
  onSubmit,
}: {
  config: CallConfig;
  campaignFields?: CampaignFieldDef[]; // campaign customer ho to extra fields
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<CallFormState>(EMPTY);
  const [custom, setCustom] = useState<CustomFieldInputs>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const outcome = config.outcomes.find((o) => o.id === form.outcomeId);
  const nextAction = config.nextActions.find((a) => a.id === form.nextActionId);
  const connected = outcome?.isConnected ?? false;
  const required = (field: keyof CallConfig['requiredFields']) =>
    isFieldRequired(config.requiredFields[field], connected);
  const star = (yes: boolean) => (yes ? ' *' : '');

  const set = <K extends keyof CallFormState>(
    key: K,
    value: CallFormState[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Kaunsa button dabaya: "Save & Next" ya "Save & Stop" (agla customer nahi, break)
    const stop =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'stop';
    const customResult = validateCustomFieldInputs(campaignFields, custom);
    const problems = [
      ...validateCallForm(form, outcome, nextAction, config.requiredFields),
      ...customResult.errors,
    ];
    setErrors(problems);
    setServerError(null);
    if (problems.length) return; // next customer release NAHI hoga

    setSaving(true);
    try {
      await onSubmit({
        outcomeId: form.outcomeId,
        nextActionId: form.nextActionId,
        userResponse: form.userResponse || undefined,
        notes: form.notes || undefined,
        interestRating: form.interestRating ?? undefined,
        // datetime-local (local time) → ISO with timezone
        followUpAt:
          nextAction?.requiresFollowUp && form.followUpAt
            ? new Date(form.followUpAt).toISOString()
            : undefined,
        customFields: campaignFields.length ? customResult.values : undefined,
        stop: stop || undefined,
      });
      setForm(EMPTY); // agla customer → khaali form
      setCustom({});
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"
      noValidate
    >
      <h3 className="font-semibold text-slate-900">Call form</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Call Outcome *">
          <Select
            value={form.outcomeId}
            onChange={(e) => set('outcomeId', e.target.value)}
          >
            <option value="">— Select —</option>
            {config.outcomes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next Action *">
          <Select
            value={form.nextActionId}
            onChange={(e) => set('nextActionId', e.target.value)}
          >
            <option value="">— Select —</option>
            {config.nextActions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
                {a.requiresFollowUp ? ' ⏰' : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {nextAction?.requiresFollowUp && (
        <Field
          label="Follow-up date & time *"
          hint="When the customer asked to be called back (e.g. today 4 PM)"
        >
          <Input
            type="datetime-local"
            value={form.followUpAt}
            onChange={(e) => set('followUpAt', e.target.value)}
          />
        </Field>
      )}

      <Field label={`User Response${star(required('userResponse'))}`}>
        <Input
          placeholder="What the customer said (short)"
          value={form.userResponse}
          onChange={(e) => set('userResponse', e.target.value)}
        />
      </Field>
      <Field label={`Conversation Notes${star(required('notes'))}`}>
        <Textarea
          rows={4}
          placeholder="What was discussed…"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">
          Interest Rating (0–10){star(required('interestRating'))}
        </p>
        <div
          className="flex flex-wrap gap-1"
          role="radiogroup"
          aria-label="Interest Rating"
        >
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={form.interestRating === n}
              onClick={() =>
                set('interestRating', form.interestRating === n ? null : n)
              }
              className={`h-9 w-9 rounded-md border text-sm font-medium ${
                form.interestRating === n
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {campaignFields.length > 0 && (
        <fieldset className="space-y-4 rounded-md border border-indigo-200 bg-indigo-50/40 p-4">
          <legend className="px-1 text-sm font-semibold text-indigo-900">
            Campaign fields
          </legend>
          {campaignFields.map((f) => (
            <Field key={f.id} label={`${f.label}${star(f.required)}`}>
              {f.type === 'SELECT' || f.type === 'BOOLEAN' ? (
                <Select
                  value={String(custom[f.key] ?? '')}
                  onChange={(e) =>
                    setCustom((c) => ({ ...c, [f.key]: e.target.value }))
                  }
                >
                  <option value="">— Select —</option>
                  {(f.type === 'BOOLEAN' ? ['true', 'false'] : f.options).map(
                    (o) => (
                      <option key={o} value={o}>
                        {f.type === 'BOOLEAN'
                          ? o === 'true'
                            ? 'Yes'
                            : 'No'
                          : o}
                      </option>
                    ),
                  )}
                </Select>
              ) : (
                <Input
                  type={f.type === 'NUMBER' ? 'number' : 'text'}
                  maxLength={f.type === 'TEXT' ? 500 : undefined}
                  value={String(custom[f.key] ?? '')}
                  onChange={(e) =>
                    setCustom((c) => ({ ...c, [f.key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
        </fieldset>
      )}

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
      <ErrorMessage message={serverError} />

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={saving}
          className="flex-1 py-3 text-base"
        >
          {saving ? 'Saving…' : 'Save & Next →'}
        </Button>
        <Button
          type="submit"
          name="stop"
          variant="secondary"
          disabled={saving}
          className="py-3"
          title="Save the call without opening the next customer (break / end of shift)"
        >
          Save & Stop ⏸
        </Button>
      </div>
    </form>
  );
}
