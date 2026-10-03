'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TeamFormModal } from '@/components/teams/team-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { isManager } from '@/lib/permissions';
import type { Staff, Team } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function TeamsPage() {
  const { user } = useAuth();
  const canEdit = user ? isManager(user.role) : false;
  const [modal, setModal] = useState<{ team?: Team } | null>(null);

  const teams = useApi<Team[]>('/teams');
  // Leader dropdown ke liye — sirf Manager ko chahiye (TL ko /staff access nahi)
  const leaders = useApi<Staff[]>(
    canEdit ? '/staff?role=TEAM_LEADER&isActive=true' : null,
  );

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Teams"
        description={canEdit ? 'Saari teams' : 'Aapki teams'}
        actions={
          canEdit && <Button onClick={() => setModal({})}>+ New team</Button>
        }
      />
      <ErrorMessage message={teams.error} />

      {teams.loading && !teams.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <Table
          headers={['Team', 'Leader', 'Members', 'Status', '']}
          empty={teams.data?.length === 0}
        >
          {teams.data?.map((t) => (
            <tr key={t.id}>
              <Td>
                <Link
                  href={`/teams/${t.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {t.name}
                </Link>
                {t.description && (
                  <p className="text-xs text-slate-500">{t.description}</p>
                )}
              </Td>
              <Td>
                {t.leader?.name ?? (
                  <span className="text-slate-400">No leader</span>
                )}
              </Td>
              <Td>{t._count.members}</Td>
              <Td>
                {t.isActive ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="red">Inactive</Badge>
                )}
              </Td>
              <Td className="text-right">
                {canEdit && (
                  <Button variant="ghost" onClick={() => setModal({ team: t })}>
                    Edit
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {modal && (
        <TeamFormModal
          team={modal.team}
          leaders={leaders.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            teams.reload();
          }}
        />
      )}
    </div>
  );
}
