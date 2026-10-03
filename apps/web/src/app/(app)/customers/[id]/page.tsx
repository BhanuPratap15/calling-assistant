'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AssignModal } from '@/components/assignments/assign-modal';
import { CustomerProfileView } from '@/components/customers/customer-profile-view';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import type { CustomerProfile } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** /customers/<id> — 360° profile (Manager / Team Leader) */
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useApi<CustomerProfile>(`/customers/${id}/profile`);
  const [assigning, setAssigning] = useState(false);
  const open = profile.data?.assignments[0];

  return (
    <div className="max-w-3xl">
      <Link
        href="/customers"
        className="text-sm text-indigo-600 hover:underline"
      >
        ← All customers
      </Link>
      <div className="mt-3" />
      <ErrorMessage message={profile.error} />
      {profile.data && (
        <>
          {profile.data.status === 'ACTIVE' && (
            <div className="mb-3 flex justify-end">
              <Button onClick={() => setAssigning(true)}>
                {open ? 'Reassign' : 'Assign to staff'}
              </Button>
            </div>
          )}
          <CustomerProfileView customer={profile.data} />
          {assigning && (
            <AssignModal
              customer={profile.data}
              reassignId={open?.id}
              currentStaffId={open?.staff.id}
              onClose={() => setAssigning(false)}
              onDone={() => {
                setAssigning(false);
                profile.reload();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
