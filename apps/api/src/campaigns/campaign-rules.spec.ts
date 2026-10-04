import {
  canTransition,
  validateCustomFields,
  validateFieldDefinitions,
  type FieldDefinition,
} from './campaign-rules.js';

describe('canTransition', () => {
  it.each([
    ['DRAFT', 'ACTIVE', true],
    ['ACTIVE', 'PAUSED', true],
    ['PAUSED', 'ACTIVE', true],
    ['ACTIVE', 'COMPLETED', true],
    ['ACTIVE', 'DRAFT', false],
    ['COMPLETED', 'ACTIVE', false],
    ['COMPLETED', 'COMPLETED', true],
  ] as const)('%s → %s = %s', (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok);
  });
});

const field = (
  f: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'type'>,
): FieldDefinition => ({
  label: f.key,
  options: [],
  required: false,
  isActive: true,
  ...f,
});

describe('validateFieldDefinitions', () => {
  it('accepts valid definitions', () => {
    expect(
      validateFieldDefinitions([
        field({ key: 'deposit_amount', type: 'NUMBER' }),
        field({ key: 'game', type: 'SELECT', options: ['Slots', 'Poker'] }),
      ]),
    ).toEqual([]);
  });

  it('rejects bad keys, duplicates and bad options', () => {
    expect(
      validateFieldDefinitions([
        field({ key: 'Bad Key', type: 'TEXT' }),
        field({ key: 'game', type: 'SELECT', options: [] }),
        field({ key: 'game', type: 'SELECT', options: ['A', 'A'] }),
        field({ key: 'notes2', type: 'TEXT', options: ['x'] }),
      ]),
    ).toEqual([
      'Bad Key: key must be snake_case (e.g. deposit_amount)',
      'game: SELECT needs at least one option',
      'Duplicate field key game',
      'game: duplicate options',
      'notes2: options are only allowed for SELECT',
    ]);
  });
});

describe('validateCustomFields', () => {
  const defs = [
    field({
      key: 'game',
      label: 'Favourite game',
      type: 'SELECT',
      options: ['Slots', 'Poker'],
      required: true,
    }),
    field({ key: 'deposit', label: 'Deposit', type: 'NUMBER' }),
    field({ key: 'wants_bonus', label: 'Wants bonus', type: 'BOOLEAN' }),
    field({ key: 'comment', label: 'Comment', type: 'TEXT' }),
    field({
      key: 'old',
      label: 'Old',
      type: 'TEXT',
      required: true,
      isActive: false,
    }),
  ];

  it('valid values are cleaned and kept', () => {
    expect(
      validateCustomFields(defs, {
        game: 'Poker',
        deposit: 5000,
        wants_bonus: false,
        comment: '  hi ',
      }),
    ).toEqual({
      errors: [],
      clean: {
        game: 'Poker',
        deposit: 5000,
        wants_bonus: false,
        comment: 'hi',
      },
    });
  });

  it('required missing, wrong types, bad option, unknown key', () => {
    expect(
      validateCustomFields(defs, {
        deposit: '5000',
        wants_bonus: 'yes',
        hack: 1,
      }).errors,
    ).toEqual([
      'Unknown custom field: hack',
      'Favourite game is required',
      'Deposit must be a number',
      'Wants bonus must be yes/no',
    ]);
    expect(validateCustomFields(defs, { game: 'Bingo' }).errors).toEqual([
      'Favourite game must be one of: Slots, Poker',
    ]);
  });

  it('inactive fields are ignored (even if required); empty optional values dropped', () => {
    expect(
      validateCustomFields(defs, { game: 'Slots', comment: '   ' }),
    ).toEqual({
      errors: [],
      clean: { game: 'Slots' },
    });
  });

  it('no definitions → nothing required, any key rejected', () => {
    expect(validateCustomFields([], undefined)).toEqual({
      errors: [],
      clean: {},
    });
    expect(validateCustomFields([], { x: 1 }).errors).toEqual([
      'Unknown custom field: x',
    ]);
  });
});
