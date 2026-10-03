/**
 * Call form ke configurable fields ka rule:
 *   always    → har call pe zaroori
 *   connected → sirf jab outcome.isConnected = true (customer se baat hui)
 *   optional  → kabhi zaroori nahi
 */
export const REQUIRED_RULES = ['always', 'connected', 'optional'] as const;
export type RequiredRule = (typeof REQUIRED_RULES)[number];

/** Kaun se fields configurable hain (Outcome + Next Action hamesha zaroori) */
export interface RequiredFieldsConfig {
  userResponse: RequiredRule;
  notes: RequiredRule;
  interestRating: RequiredRule;
}

export const REQUIRED_FIELDS_KEY = 'call_form.required_fields';

/** DB me setting na mile tab bhi app chale (migration wale defaults jaisa) */
export const DEFAULT_REQUIRED_FIELDS: RequiredFieldsConfig = {
  userResponse: 'connected',
  notes: 'connected',
  interestRating: 'connected',
};
