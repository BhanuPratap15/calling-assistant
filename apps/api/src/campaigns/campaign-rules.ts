import type {
  CampaignFieldType,
  CampaignStatus,
} from '../generated/prisma/enums.js';

/**
 * Campaign rules — PURE functions (unit tests: campaign-rules.spec.ts)
 */

// ---------- Status (state machine) ----------
// DRAFT → ACTIVE ↔ PAUSED → COMPLETED. COMPLETED final (reports stable rahein).
const TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ['ACTIVE', 'COMPLETED'],
  ACTIVE: ['PAUSED', 'COMPLETED'],
  PAUSED: ['ACTIVE', 'COMPLETED'],
  COMPLETED: [],
};

export function canTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

// ---------- Custom field definitions ----------
export interface FieldDefinition {
  key: string;
  label: string;
  type: CampaignFieldType;
  options: string[];
  required: boolean;
  isActive: boolean;
}

export const FIELD_KEY_RULE = /^[a-z][a-z0-9_]{0,39}$/;

export function validateFieldDefinitions(fields: FieldDefinition[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const f of fields) {
    if (!FIELD_KEY_RULE.test(f.key))
      errors.push(`${f.key}: key must be snake_case (e.g. deposit_amount)`);
    if (keys.has(f.key)) errors.push(`Duplicate field key ${f.key}`);
    keys.add(f.key);
    if (f.type === 'SELECT') {
      const opts = f.options.map((o) => o.trim()).filter(Boolean);
      if (!opts.length)
        errors.push(`${f.key}: SELECT needs at least one option`);
      if (new Set(opts).size !== opts.length)
        errors.push(`${f.key}: duplicate options`);
    } else if (f.options.length) {
      errors.push(`${f.key}: options are only allowed for SELECT`);
    }
  }
  return errors;
}

// ---------- Call ke custom values ----------
export type CustomValue = string | number | boolean;

/**
 * Assistant ne jo bhara usko campaign ke (active) fields se check karo.
 *   - unknown key → error (koi bhi random data DB me na jaaye)
 *   - required + khaali → error
 *   - type check: NUMBER → number, BOOLEAN → boolean, SELECT → options me se, TEXT → string (max 500)
 * clean = sirf valid, non-empty values (DB me yahi save hota hai)
 */
export function validateCustomFields(
  definitions: FieldDefinition[],
  values: Record<string, unknown> | undefined | null,
): { errors: string[]; clean: Record<string, CustomValue> } {
  const errors: string[] = [];
  const clean: Record<string, CustomValue> = {};
  const active = definitions.filter((d) => d.isActive);
  const input = values ?? {};

  for (const key of Object.keys(input)) {
    if (!active.some((d) => d.key === key))
      errors.push(`Unknown custom field: ${key}`);
  }

  for (const def of active) {
    const raw = input[def.key];
    const empty =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim() === '');
    if (empty) {
      if (def.required) errors.push(`${def.label} is required`);
      continue;
    }
    switch (def.type) {
      case 'TEXT':
        if (typeof raw !== 'string') errors.push(`${def.label} must be text`);
        else if (raw.length > 500)
          errors.push(`${def.label} is too long (max 500)`);
        else clean[def.key] = raw.trim();
        break;
      case 'NUMBER':
        if (typeof raw !== 'number' || !Number.isFinite(raw))
          errors.push(`${def.label} must be a number`);
        else clean[def.key] = raw;
        break;
      case 'BOOLEAN':
        if (typeof raw !== 'boolean')
          errors.push(`${def.label} must be yes/no`);
        else clean[def.key] = raw;
        break;
      case 'SELECT':
        if (typeof raw !== 'string' || !def.options.includes(raw)) {
          errors.push(`${def.label} must be one of: ${def.options.join(', ')}`);
        } else clean[def.key] = raw;
        break;
    }
  }
  return { errors, clean };
}
