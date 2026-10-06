'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import {
  ROLE_LABELS,
  type CampaignDetail,
  type Staff,
  type Team,
} from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Kaun is campaign ke customers call karega.
 * Koi nahi chuna = SAB assistants. Staff chuna ya team chuni → sirf wahi (team ke saare members).
 */
export function CampaignMembersTab({
  campaign,
  canEdit,
  onSaved,
}: {
  campaign: CampaignDetail;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [staffIds, setStaffIds] = useState(
    campaign.staff.map((s) => s.staff.id),
  );
  const [teamIds, setTeamIds] = useState(campaign.teams.map((t) => t.team.id));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Sirf Manager ko list chahiye (edit ke liye); TL ko current members dikhte hain
  const staff = useApi<Staff[]>(canEdit ? '/staff?isActive=true' : null);
  const teams = useApi<Team[]>(canEdit ? '/teams' : null);

  if (!canEdit) {
    const names = [
      ...campaign.teams.map((t) => `Team ${t.team.name}`),
      ...campaign.staff.map((s) => s.staff.name),
    ];
    return (
      <p className="rounded-xl border border-slate-200 bg-white shadow-card p-5 text-sm text-slate-700">
        {names.length ? names.join(', ') : 'All assistants (no restriction)'}
      </p>
    );
  }

  const toggle = (setter: typeof setStaffIds) => (id: string) => {
    setSaved(false);
    setter((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/campaigns/${campaign.id}/members`, {
        method: 'PUT',
        body: { staffIds, teamIds },
      });
      setSaved(true);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const callers = staff.data?.filter(
    (s) => s.role === 'ASSISTANT' || s.role === 'TEAM_LEADER',
  );

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
        {staffIds.length + teamIds.length === 0
          ? "Nobody selected → ALL assistants can call this campaign's customers."
          : "Only the selected staff and members of the selected teams will get this campaign's customers."}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="rounded-xl border border-slate-200 bg-white shadow-card p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Teams
          </legend>
          {teams.data
            ?.filter((t) => t.isActive)
            .map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-2 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={teamIds.includes(t.id)}
                  onChange={() => toggle(setTeamIds)(t.id)}
                />
                {t.name}
                <span className="text-xs text-slate-400">
                  ({t._count.members} members)
                </span>
              </label>
            ))}
          {teams.data?.length === 0 && (
            <p className="text-sm text-slate-400">No teams</p>
          )}
        </fieldset>
        <fieldset className="rounded-xl border border-slate-200 bg-white shadow-card p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">
            Staff
          </legend>
          {callers?.map((s) => (
            <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={staffIds.includes(s.id)}
                onChange={() => toggle(setStaffIds)(s.id)}
              />
              {s.name}
              <span className="text-xs text-slate-400">
                {ROLE_LABELS[s.role]}
                {s.team ? ` · ${s.team.name}` : ''}
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <ErrorMessage message={error ?? staff.error ?? teams.error} />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save members'}
        </Button>
      </div>
    </div>
  );
}
