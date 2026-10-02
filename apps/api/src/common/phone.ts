import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Phone number ko ek standard format (E.164) me badalta hai.
 *   "98765 43210", "+91-98765-43210", "09876543210"  →  "+919876543210"
 * Ek hi number alag-alag tarike se likha ho tab bhi duplicate pakda jaaye.
 * Galat number → null.
 */
export function normalizePhone(
  input: string,
  defaultCountry: CountryCode = 'IN',
): string | null {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}
