import type { RequiredFieldsConfig, RequiredRule } from './types';

/**
 * Backend ke apps/api/src/calling/call-form-validation.ts ka copy —
 * assistant ko turant (server pe bhejne se pehle) dikhe kya missing hai.
 * Asli check backend karta hai; dono ko sync rakho.
 */
export function isFieldRequired(
  rule: RequiredRule,
  isConnected: boolean,
): boolean {
  return rule === 'always' || (rule === 'connected' && isConnected);
}

export interface CallFormState {
  outcomeId: string;
  nextActionId: string;
  userResponse: string;
  notes: string;
  interestRating: number | null;
  followUpAt: string; // <input type="datetime-local"> value: "2026-10-03T16:00"
}

export const FIELD_LABELS: Record<keyof RequiredFieldsConfig, string> = {
  userResponse: 'User Response',
  notes: 'Conversation Notes',
  interestRating: 'Interest Rating',
};

export function validateCallForm(
  form: CallFormState,
  outcome: { isConnected: boolean } | undefined,
  nextAction: { requiresFollowUp: boolean } | undefined,
  rules: RequiredFieldsConfig,
): string[] {
  const errors: string[] = [];
  if (!outcome) errors.push('Call Outcome chuniye');
  if (!nextAction) errors.push('Next Action chuniye');
  if (!outcome || !nextAction) return errors;

  for (const field of Object.keys(rules) as (keyof RequiredFieldsConfig)[]) {
    if (!isFieldRequired(rules[field], outcome.isConnected)) continue;
    const value = form[field];
    const blank =
      value === null || (typeof value === 'string' && !value.trim());
    if (blank) errors.push(`${FIELD_LABELS[field]} zaroori hai`);
  }
  if (nextAction.requiresFollowUp) {
    if (!form.followUpAt) errors.push('Follow-up date/time zaroori hai');
    else if (new Date(form.followUpAt).getTime() <= Date.now())
      errors.push('Follow-up time future me hona chahiye');
  }
  return errors;
}
