import type { RequiredFieldsConfig } from '../call-config/call-config.types.js';
import { isFieldRequired, validateCallForm } from './call-form-validation.js';

const now = new Date('2026-10-03T10:00:00Z');
const later = new Date('2026-10-03T16:00:00Z');
const earlier = new Date('2026-10-03T09:00:00Z');

const connectedRules: RequiredFieldsConfig = {
  userResponse: 'connected',
  notes: 'connected',
  interestRating: 'connected',
};
const connected = { isConnected: true };
const notConnected = { isConnected: false };
const noFollowUp = { requiresFollowUp: false };
const followUp = { requiresFollowUp: true };

describe('isFieldRequired', () => {
  it.each([
    ['always', false, true],
    ['always', true, true],
    ['connected', true, true],
    ['connected', false, false],
    ['optional', true, false],
  ] as const)('%s + connected=%s → %s', (rule, isConnected, expected) => {
    expect(isFieldRequired(rule, isConnected)).toBe(expected);
  });
});

describe('validateCallForm', () => {
  it('No Answer (not connected): nothing else required', () => {
    expect(
      validateCallForm({}, notConnected, noFollowUp, connectedRules, now),
    ).toEqual([]);
  });

  it('Connected: notes, response and rating required', () => {
    expect(
      validateCallForm(
        { notes: '   ' },
        connected,
        noFollowUp,
        connectedRules,
        now,
      ),
    ).toEqual([
      'userResponse is required',
      'notes is required',
      'interestRating is required',
    ]);
  });

  it('rating 0 counts as filled (0 is a valid rating)', () => {
    expect(
      validateCallForm(
        { userResponse: 'ok', notes: 'talked', interestRating: 0 },
        connected,
        noFollowUp,
        connectedRules,
        now,
      ),
    ).toEqual([]);
  });

  it('"always" rule applies even when not connected', () => {
    expect(
      validateCallForm(
        {},
        notConnected,
        noFollowUp,
        { ...connectedRules, notes: 'always' },
        now,
      ),
    ).toEqual(['notes is required']);
  });

  it('follow-up action needs a future date/time (4 PM example)', () => {
    expect(
      validateCallForm({}, notConnected, followUp, connectedRules, now),
    ).toEqual(['followUpAt is required for this next action']);
    expect(
      validateCallForm(
        { followUpAt: earlier },
        notConnected,
        followUp,
        connectedRules,
        now,
      ),
    ).toEqual(['followUpAt must be in the future']);
    expect(
      validateCallForm(
        { followUpAt: later },
        notConnected,
        followUp,
        connectedRules,
        now,
      ),
    ).toEqual([]);
  });
});
