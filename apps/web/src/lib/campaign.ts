import type {
  CampaignFieldDef,
  CampaignStatus,
  CustomFieldValue,
} from './types';

/**
 * Backend ke apps/api/src/campaigns/campaign-rules.ts ka UI copy —
 * buttons dikhana/chhupana + assistant ko turant error. Asli check backend karta hai; dono sync rakho.
 */

export const CAMPAIGN_STATUS_TONE = {
  DRAFT: 'gray',
  ACTIVE: 'green',
  PAUSED: 'yellow',
  COMPLETED: 'blue',
} as const;

// DRAFT → ACTIVE ↔ PAUSED → COMPLETED (COMPLETED final)
const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['ACTIVE', 'COMPLETED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED'],
  COMPLETED: [],
};

export function nextStatuses(from: CampaignStatus): CampaignStatus[] {
  return TRANSITIONS[from];
}

/** Button ka text: ACTIVE → "Activate" (DRAFT se) / "Resume" (PAUSED se) */
export function statusActionLabel(
  from: CampaignStatus,
  to: CampaignStatus,
): string {
  if (to === 'ACTIVE') return from === 'PAUSED' ? '▶ Resume' : '▶ Activate';
  if (to === 'PAUSED') return '⏸ Pause';
  return '✓ Complete';
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

/** Form state (sab string/boolean) → API values. Khaali chhod do. */
export type CustomFieldInputs = Record<string, string | boolean>;

export function validateCustomFieldInputs(
  fields: CampaignFieldDef[],
  inputs: CustomFieldInputs,
): { errors: string[]; values: Record<string, CustomFieldValue> } {
  const errors: string[] = [];
  const values: Record<string, CustomFieldValue> = {};
  for (const f of fields) {
    const raw = inputs[f.key];
    if (f.type === 'BOOLEAN') {
      // Checkbox: required BOOLEAN = "haan/na me se ek chuno" → select use karte hain
      if (raw === undefined || raw === '') {
        if (f.required) errors.push(`${f.label} is required`);
      } else values[f.key] = raw === true || raw === 'true';
      continue;
    }
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
      if (f.required) errors.push(`${f.label} is required`);
      continue;
    }
    if (f.type === 'NUMBER') {
      const n = Number(text);
      if (!Number.isFinite(n)) errors.push(`${f.label} must be a number`);
      else values[f.key] = n;
    } else if (f.type === 'TEXT' && text.length > 500) {
      errors.push(`${f.label} is too long (max 500)`);
    } else {
      values[f.key] = text;
    }
  }
  return { errors, values };
}

/** Call history me dikhane ke liye: true → "Yes" */
export function formatCustomValue(value: CustomFieldValue): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
