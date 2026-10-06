'use client';

import { ChangePasswordForm } from '@/components/account/change-password-form';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABELS } from '@/lib/types';

/** /account — apni details + password badlo (har role) */
export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="max-w-lg">
      <PageHeader
        title="My account"
        description={`${user.name} · ${ROLE_LABELS[user.role]}`}
      />
      <div className="rounded-xl border border-slate-200 bg-white shadow-card p-5">
        <p className="mb-4 text-sm text-slate-600">
          Login email: <b>{user.email}</b>
        </p>
        <h2 className="mb-3 font-semibold text-slate-900">Change password</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
