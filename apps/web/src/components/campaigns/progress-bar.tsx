import { percent } from '@/lib/campaign';

/** "120 / 500 called" + patli bar */
export function ProgressBar({
  done,
  total,
  label = 'called',
}: {
  done: number;
  total: number;
  label?: string;
}) {
  const pct = percent(done, total);
  return (
    <div className="min-w-32">
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% ${label}`}
      >
        <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {done} / {total} {label} ({pct}%)
      </p>
    </div>
  );
}
