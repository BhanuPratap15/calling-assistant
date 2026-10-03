import {
  categoryForRating,
  validateCategoryRanges,
  type CategoryRange,
} from './category-rules.js';

const defaults: CategoryRange[] = [
  {
    code: 'LOW_INTEREST',
    minRating: 0,
    maxRating: 4,
    isActive: true,
    sortOrder: 10,
  },
  {
    code: 'MEDIUM_INTEREST',
    minRating: 5,
    maxRating: 7,
    isActive: true,
    sortOrder: 20,
  },
  {
    code: 'HIGH_INTEREST',
    minRating: 8,
    maxRating: 9,
    isActive: true,
    sortOrder: 30,
  },
  { code: 'VIP', minRating: 10, maxRating: 10, isActive: true, sortOrder: 40 },
];

describe('categoryForRating (design doc defaults)', () => {
  it.each([
    [0, 'LOW_INTEREST'],
    [4, 'LOW_INTEREST'],
    [5, 'MEDIUM_INTEREST'],
    [7, 'MEDIUM_INTEREST'],
    [8, 'HIGH_INTEREST'],
    [9, 'HIGH_INTEREST'],
    [10, 'VIP'],
  ])('rating %i → %s', (rating, code) => {
    expect(categoryForRating(rating, defaults)?.code).toBe(code);
  });

  it('no rating → no category', () => {
    expect(categoryForRating(null, defaults)).toBeNull();
    expect(categoryForRating(undefined, defaults)).toBeNull();
  });

  it('inactive categories are ignored', () => {
    const noVip = defaults.map((c) =>
      c.code === 'VIP' ? { ...c, isActive: false } : c,
    );
    expect(categoryForRating(10, noVip)).toBeNull();
  });

  it('admin changes "8+" to "7+" → rating 7 becomes High (no code change)', () => {
    const changed = defaults.map((c) =>
      c.code === 'MEDIUM_INTEREST'
        ? { ...c, maxRating: 6 }
        : c.code === 'HIGH_INTEREST'
          ? { ...c, minRating: 7 }
          : c,
    );
    expect(validateCategoryRanges(changed).errors).toEqual([]);
    expect(categoryForRating(7, changed)?.code).toBe('HIGH_INTEREST');
  });
});

describe('validateCategoryRanges', () => {
  it('defaults are valid and cover 0–10', () => {
    expect(validateCategoryRanges(defaults)).toEqual({
      errors: [],
      uncovered: [],
    });
  });

  it('detects overlap between active categories', () => {
    const overlap = defaults.map((c) =>
      c.code === 'HIGH_INTEREST' ? { ...c, minRating: 7 } : c,
    );
    expect(validateCategoryRanges(overlap).errors).toEqual([
      'MEDIUM_INTEREST and HIGH_INTEREST overlap (5–7 / 7–9)',
    ]);
  });

  it('inactive categories may overlap (they are not used)', () => {
    const extra = [
      ...defaults,
      { code: 'OLD', minRating: 0, maxRating: 10, isActive: false },
    ];
    expect(validateCategoryRanges(extra).errors).toEqual([]);
  });

  it('rejects bad bounds, reversed ranges and duplicate codes', () => {
    const { errors } = validateCategoryRanges([
      { code: 'A', minRating: -1, maxRating: 11, isActive: false },
      { code: 'B', minRating: 6, maxRating: 3, isActive: false },
      { code: 'B', minRating: 0, maxRating: 0, isActive: false },
    ]);
    expect(errors).toEqual([
      'A: ratings must be between 0 and 10',
      'B: minRating cannot be greater than maxRating',
      'Duplicate code B',
    ]);
  });

  it('reports gaps as warnings (not errors)', () => {
    const gap = defaults.filter((c) => c.code !== 'MEDIUM_INTEREST');
    expect(validateCategoryRanges(gap)).toEqual({
      errors: [],
      uncovered: [5, 6, 7],
    });
  });
});
