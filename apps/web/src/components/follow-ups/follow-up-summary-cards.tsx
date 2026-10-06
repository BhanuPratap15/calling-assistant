import Link from 'next/link';
import type { FollowUpSummary } from '@/lib/types';

const CARDS: {
  key: keyof FollowUpSummary;
  label: string;
  tone: string;
  bucket?: string;
}[] = [
  { key: 'overdue', label: 'Overdue', tone: 'text-red-700', bucket: 'overdue' },
  { key: 'due', label: 'Due now', tone: 'text-amber-700', bucket: 'due' },
  {
    key: 'upcoming',
    label: 'Upcoming',
    tone: 'text-slate-900',
    bucket: 'upcoming',
  },
  {
    key: 'completedToday',
    label: 'Completed today',
    tone: 'text-green-700',
    bucket: 'completed',
  },
];

/** Follow-up counts (design doc section 14) — dashboard + follow-ups page dono pe */
export function FollowUpSummaryCards({
  summary,
  onSelect,
}: {
  summary: FollowUpSummary;
  onSelect?: (bucket: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((c) => {
        const content = (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {c.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${c.tone}`}>
              {summary[c.key]}
            </p>
          </>
        );
        const cls =
          'rounded-xl border border-slate-200 bg-white shadow-card p-4 text-left hover:border-indigo-300';
        return onSelect ? (
          <button
            key={c.key}
            className={cls}
            onClick={() => onSelect(c.bucket!)}
          >
            {content}
          </button>
        ) : (
          <Link
            key={c.key}
            href={`/follow-ups?bucket=${c.bucket}`}
            className={cls}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
