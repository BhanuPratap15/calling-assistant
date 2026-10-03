'use client';

import { useState } from 'react';
import {
  OptionFormModal,
  type OptionFormConfig,
} from '@/components/settings/option-form-modal';
import { FollowUpTimingCard } from '@/components/settings/follow-up-timing-card';
import { RequiredFieldsCard } from '@/components/settings/required-fields-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { Table, Td } from '@/components/ui/table';
import type { CallConfig, CallOutcome, NextAction } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const OUTCOME_FORM: OptionFormConfig = {
  endpoint: '/call-config/outcomes',
  title: 'call outcome',
  flagKey: 'isConnected',
  flagLabel:
    'Connected — customer se baat hui (notes/rating maange ja sakte hain)',
};

const ACTION_FORM: OptionFormConfig = {
  endpoint: '/call-config/next-actions',
  title: 'next action',
  flagKey: 'requiresFollowUp',
  flagLabel: 'Follow-up date/time zaroori',
};

type ModalState =
  | { kind: 'outcome'; option?: CallOutcome }
  | { kind: 'action'; option?: NextAction }
  | null;

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const config = useApi<CallConfig>('/call-config/admin');
  const [modal, setModal] = useState<ModalState>(null);

  const statusBadge = (active: boolean) =>
    active ? (
      <Badge tone="green">Active</Badge>
    ) : (
      <Badge tone="gray">Inactive</Badge>
    );

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Call form ke options — company ki zaroorat ke hisaab se badlo, code change nahi"
      />
      <ErrorMessage message={config.error} />
      {config.loading && !config.data && (
        <p className="text-slate-500">Loading…</p>
      )}

      {config.data && (
        <>
          <Section
            title="Call outcomes"
            action={
              <Button onClick={() => setModal({ kind: 'outcome' })}>
                + Add outcome
              </Button>
            }
          >
            <Table headers={['Label', 'Code', 'Type', 'Order', 'Status', '']}>
              {config.data.outcomes.map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-slate-900">{o.label}</Td>
                  <Td className="font-mono text-xs">{o.code}</Td>
                  <Td>
                    {o.isConnected ? (
                      <Badge tone="blue">Connected</Badge>
                    ) : (
                      <Badge>Not connected</Badge>
                    )}
                  </Td>
                  <Td>{o.sortOrder}</Td>
                  <Td>{statusBadge(o.isActive)}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => setModal({ kind: 'outcome', option: o })}
                    >
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section
            title="Next actions"
            action={
              <Button onClick={() => setModal({ kind: 'action' })}>
                + Add next action
              </Button>
            }
          >
            <Table
              headers={['Label', 'Code', 'Follow-up', 'Order', 'Status', '']}
            >
              {config.data.nextActions.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium text-slate-900">{a.label}</Td>
                  <Td className="font-mono text-xs">{a.code}</Td>
                  <Td>
                    {a.requiresFollowUp ? (
                      <Badge tone="yellow">Date/time required</Badge>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{a.sortOrder}</Td>
                  <Td>{statusBadge(a.isActive)}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => setModal({ kind: 'action', option: a })}
                    >
                      Edit
                    </Button>
                  </Td>
                </tr>
              ))}
            </Table>
          </Section>

          <Section title="Follow-up timing">
            <FollowUpTimingCard
              initial={config.data.followUpTiming}
              onSaved={config.reload}
            />
          </Section>

          <Section title="Mandatory fields">
            <RequiredFieldsCard
              initial={config.data.requiredFields}
              onSaved={config.reload}
            />
          </Section>
        </>
      )}

      {modal && (
        <OptionFormModal
          config={modal.kind === 'outcome' ? OUTCOME_FORM : ACTION_FORM}
          option={modal.option}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            config.reload();
          }}
        />
      )}
    </div>
  );
}
