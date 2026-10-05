'use client';

import { Input, Select } from '@/components/ui/form';
import { RANGE_LABELS, type ReportFilters } from '@/lib/report';
import type { AssignableStaff, Campaign, RangePreset, Team } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const PRESETS: RangePreset[] = ['today', 'yesterday', '7d', '30d', 'custom'];

/**
 * Ek row, charts ke upar — date range pehle (dataviz: filters sab neeche wale charts pe lagte hain).
 * Team / staff / campaign sirf Manager / TL ko (assistant ke liye apne hi numbers).
 */
export function ReportFilterBar({
  value,
  onChange,
  showPeople,
  showTeam,
}: {
  value: ReportFilters;
  onChange: (f: ReportFilters) => void;
  showPeople: boolean; // Manager / TL
  showTeam: boolean; // sirf Manager (TL ki ek hi team)
}) {
  const teams = useApi<Team[]>(showTeam ? '/teams' : null);
  const staff = useApi<AssignableStaff[]>(
    showPeople ? '/assignments/assignable-staff' : null,
  );
  const campaigns = useApi<Campaign[]>(showPeople ? '/campaigns' : null);
  const set = (patch: Partial<ReportFilters>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <Select
        aria-label="Date range"
        className="w-40"
        value={value.range}
        onChange={(e) => set({ range: e.target.value as RangePreset })}
      >
        {PRESETS.map((p) => (
          <option key={p} value={p}>
            {RANGE_LABELS[p]}
          </option>
        ))}
      </Select>
      {value.range === 'custom' && (
        <>
          <Input
            type="date"
            aria-label="From date"
            className="w-40"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => set({ from: e.target.value })}
          />
          <span className="text-sm text-slate-400">to</span>
          <Input
            type="date"
            aria-label="To date"
            className="w-40"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => set({ to: e.target.value })}
          />
        </>
      )}
      {showTeam && (
        <Select
          aria-label="Filter by team"
          className="w-44"
          value={value.teamId}
          onChange={(e) => set({ teamId: e.target.value, staffId: '' })}
        >
          <option value="">All teams</option>
          {teams.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      )}
      {showPeople && (
        <Select
          aria-label="Filter by assistant"
          className="w-48"
          value={value.staffId}
          onChange={(e) => set({ staffId: e.target.value })}
        >
          <option value="">All assistants</option>
          {staff.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      {showPeople && (
        <Select
          aria-label="Filter by campaign"
          className="w-48"
          value={value.campaignId}
          onChange={(e) => set({ campaignId: e.target.value })}
        >
          <option value="">All calls</option>
          {campaigns.data?.map((c) => (
            <option key={c.id} value={c.id}>
              📣 {c.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
