import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+971501234567', '+971501234567'], // UAE number bhi chalega
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['12345', 'abcdefghij', ''])('rejects invalid "%s"', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
