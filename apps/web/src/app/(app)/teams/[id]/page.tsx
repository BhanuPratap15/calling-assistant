'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td } from '@/components/ui/table';
import { humanize } from '@/lib/format';
import { ROLE_LABELS, type TeamDetail } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** /teams/<id> — [id] folder = "dynamic route", URL ka hissa variable ban jaata hai */
export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: team, error, loading } = useApi<TeamDetail>(`/teams/${id}`);

  return (
    <div>
      <Link href="/teams" className="text-sm text-indigo-600 hover:underline">
        ← All teams
      </Link>
      <div className="mt-3" />
      <ErrorMessage message={error} />
      {loading && !team && <p className="text-slate-500">Loading…</p>}
      {team && (
        <>
          <PageHeader
            title={team.name}
            description={`Leader: ${team.leader?.name ?? '—'} · ${team._count.members} members`}
          />
          {team.description && (
            <p className="mb-4 text-sm text-slate-600">{team.description}</p>
          )}
          <Table
            headers={['Member', 'Role', 'Availability', 'Status']}
            empty={team.members.length === 0}
          >
            {team.members.map((m) => (
              <tr key={m.id}>
                <Td>
                  <p className="font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </Td>
                <Td>{ROLE_LABELS[m.role]}</Td>
                <Td>{humanize(m.availability)}</Td>
                <Td>
                  {m.isActive ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="red">Inactive</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-slate-400">
            Member add/remove: Staff page pe us person ko Edit karke Team badlo.
          </p>
        </>
      )}
    </div>
  );
}
