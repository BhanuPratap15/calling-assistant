/**
 * Category rules — PURE functions (na DB, na HTTP) → unit test aasaan.
 * Design doc section 10: "0–4 Low, 5–7 Medium, 8–9 High, 10 VIP — configurable".
 */
export const MIN_RATING = 0;
export const MAX_RATING = 10;

export interface CategoryRange {
  id?: string;
  code: string;
  minRating: number;
  maxRating: number;
  isActive: boolean;
  sortOrder?: number;
}

/** Rating kis active category me aati hai (koi nahi → null). Overlap validation ki wajah se max ek match. */
export function categoryForRating<T extends CategoryRange>(
  rating: number | null | undefined,
  categories: T[],
): T | null {
  if (rating === null || rating === undefined) return null;
  return (
    categories
      .filter(
        (c) => c.isActive && rating >= c.minRating && rating <= c.maxRating,
      )
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0] ?? null
  );
}

/**
 * Ranges sahi hain?  errors = save mat karo;  uncovered = warning (in ratings pe koi category nahi)
 */
export function validateCategoryRanges(categories: CategoryRange[]): {
  errors: string[];
  uncovered: number[];
} {
  const errors: string[] = [];
  const codes = new Set<string>();
  for (const c of categories) {
    if (codes.has(c.code)) errors.push(`Duplicate code ${c.code}`);
    codes.add(c.code);
    if (c.minRating < MIN_RATING || c.maxRating > MAX_RATING) {
      errors.push(
        `${c.code}: ratings must be between ${MIN_RATING} and ${MAX_RATING}`,
      );
    }
    if (c.minRating > c.maxRating)
      errors.push(`${c.code}: minRating cannot be greater than maxRating`);
  }

  const active = categories.filter((c) => c.isActive);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.minRating <= b.maxRating && b.minRating <= a.maxRating) {
        errors.push(
          `${a.code} and ${b.code} overlap (${a.minRating}–${a.maxRating} / ${b.minRating}–${b.maxRating})`,
        );
      }
    }
  }

  const uncovered: number[] = [];
  for (let r = MIN_RATING; r <= MAX_RATING; r++) {
    if (!active.some((c) => r >= c.minRating && r <= c.maxRating))
      uncovered.push(r);
  }
  return { errors, uncovered };
}
