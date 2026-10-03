import type {
  RequiredFieldsConfig,
  RequiredRule,
} from '../call-config/call-config.types.js';

/**
 * Call form ka "mandatory field" logic — PURE function (na DB, na HTTP).
 * Isliye: unit test aasaan, aur frontend me same logic copy karke turant feedback.
 *
 * Rules (design doc section 7):
 *  - outcome + nextAction hamesha (DTO already check karta hai)
 *  - userResponse / notes / interestRating → Settings ka rule (always / connected / optional)
 *  - followUpAt → zaroori jab nextAction.requiresFollowUp, aur future me hona chahiye
 */
export interface CallFormValues {
  userResponse?: string | null;
  notes?: string | null;
  interestRating?: number | null;
  followUpAt?: Date | null;
}

export type ConfigurableField = keyof RequiredFieldsConfig;

export function isFieldRequired(
  rule: RequiredRule,
  isConnected: boolean,
): boolean {
  return rule === 'always' || (rule === 'connected' && isConnected);
}

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '');

export function validateCallForm(
  values: CallFormValues,
  outcome: { isConnected: boolean },
  nextAction: { requiresFollowUp: boolean },
  rules: RequiredFieldsConfig,
  now: Date = new Date(),
): string[] {
  const errors: string[] = [];

  for (const field of Object.keys(rules) as ConfigurableField[]) {
    if (
      isFieldRequired(rules[field], outcome.isConnected) &&
      isBlank(values[field])
    ) {
      errors.push(`${field} is required`);
    }
  }

  if (nextAction.requiresFollowUp) {
    if (!values.followUpAt) {
      errors.push('followUpAt is required for this next action');
    } else if (values.followUpAt.getTime() <= now.getTime()) {
      errors.push('followUpAt must be in the future');
    }
  }

  return errors;
}
