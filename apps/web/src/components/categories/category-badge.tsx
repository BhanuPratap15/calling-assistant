import { Badge } from '@/components/ui/badge';
import type { CategoryRef } from '@/lib/types';

/** "VIP · 10" — category + latest rating */
export function CategoryBadge({
  category,
  rating,
}: {
  category: CategoryRef | null | undefined;
  rating?: number | null;
}) {
  if (!category) {
    return rating !== null && rating !== undefined ? (
      <Badge>Rating {rating}</Badge>
    ) : (
      <span className="text-xs text-slate-400">Not rated</span>
    );
  }
  return (
    <Badge tone={category.color}>
      {category.label}
      {rating !== null && rating !== undefined && ` · ${rating}`}
    </Badge>
  );
}
