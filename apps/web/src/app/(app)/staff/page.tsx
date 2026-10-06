'use client';

import { useState } from 'react';
import { ResetPasswordModal } from '@/components/staff/reset-password-modal';
import { StaffFormModal } from '@/components/staff/staff-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td } from '@/components/ui/table';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, humanize } from '@/lib/format';
import { canManageRole } from '@/lib/permissions';
import { ALL_ROLES, ROLE_LABELS, type Staff, type Team } from '@/lib/types';
import { toQuery, useApi } from '@/lib/use-api';

const AVAILABILITY_TONE = {
  AVAILABLE: 'green',
  ON_CALL: 'blue',
  BREAK: 'yellow',
  OFFLINE: 'gray',
} as const;

// Modal ka state: kaunsa modal khula hai aur kis staff ke liye
type ModalState =
  | { type: 'create' }
  | { type: 'edit'; staff: Staff }
  | { type: 'reset'; staff: Staff }
  | null;

export default function StaffPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    role: '',
    teamId: '',
    isActive: 'true',
  });
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const staff = useApi<Staff[]>(`/staff${toQuery(filters)}`);
  const teams = useApi<Team[]>('/teams');

  if (!user) return null;

  const closeAndReload = (message: string) => {
    setModal(null);
    setNotice(message);
    staff.reload();
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Assistants, Team Leaders and Managers"
        actions={
          <Button onClick={() => setModal({ type: 'create' })}>
            + Add staff
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          aria-label="Filter by role"
          className="w-44"
          value={filters.role}
          onChange={(e) => setFilters({ ...filters, role: e.target.value })}
        >
          <option value="">All roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by team"
          className="w-44"
          value={filters.teamId}
          onChange={(e) => setFilters({ ...filters, teamId: e.target.value })}
        >
          <option value="">All teams</option>
          {teams.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          className="w-36"
          value={filters.isActive}
          onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="">All</option>
        </Select>
      </div>

      {notice && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {notice}
        </p>
      )}
      <ErrorMessage message={staff.error} />

      {staff.loading && !staff.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <Table
          headers={[
            'Name',
            'Role',
            'Team',
            'Availability',
            'Status',
            'Last login',
            '',
          ]}
          empty={staff.data?.length === 0}
        >
          {staff.data?.map((s) => {
            const manageable = canManageRole(user.role, s.role);
            return (
              <tr key={s.id}>
                <Td>
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </Td>
                <Td>
                  <Badge tone="indigo">{ROLE_LABELS[s.role]}</Badge>
                </Td>
                <Td>{s.team?.name ?? '—'}</Td>
                <Td>
                  <Badge tone={AVAILABILITY_TONE[s.availability]}>
                    {humanize(s.availability)}
                  </Badge>
                </Td>
                <Td>
                  {s.isActive ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="red">Inactive</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs">
                  {formatDateTime(s.lastLoginAt)}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  {manageable && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => setModal({ type: 'edit', staff: s })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setModal({ type: 'reset', staff: s })}
                      >
                        Reset password
                      </Button>
                    </>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}

      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <StaffFormModal
          staff={modal.type === 'edit' ? modal.staff : undefined}
          actorRole={user.role}
          teams={teams.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() =>
            closeAndReload(
              modal.type === 'edit' ? 'Staff updated' : 'Staff created',
            )
          }
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal
          staff={modal.staff}
          onClose={() => setModal(null)}
          onDone={() =>
            closeAndReload(`Password reset for ${modal.staff.name}`)
          }
        />
      )}
    </div>
  );
}
