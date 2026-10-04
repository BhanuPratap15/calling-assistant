'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ProgressBar } from '@/components/campaigns/progress-bar';
import { ImportRowsTable } from '@/components/imports/import-rows-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { IMPORT_STATUS_TONE } from '@/lib/import';
import type { Campaign, ImportBatch, Tag } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { useInterval } from '@/lib/use-interval';

const RUNNING = ['QUEUED', 'PROCESSING'];

/** /imports/<id> — Step 2 (preview + confirm) aur Step 3 (progress → result) */
export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const batch = useApi<ImportBatch>(`/imports/${id}`);
  const [error, setError] = useState<string | null>(null);
  const b = batch.data;

  // Background import chal raha hai → har 2 sec status / progress
  useInterval(() => {
    if (b && RUNNING.includes(b.status)) batch.reload();
  }, 2000);

  async function action(path: string, body?: object) {
    setError(null);
    try {
      await api(`/imports/${id}/${path}`, { method: 'POST', body });
      batch.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const problems = b ? b.invalidRows + b.duplicateRows + b.skippedRows : 0;

  return (
    <div>
      <Link href="/imports" className="text-sm text-indigo-600 hover:underline">
        ← Import history
      </Link>
      <div className="mt-3" />
      <ErrorMessage message={error ?? batch.error} />
      {batch.loading && !b && <p className="text-slate-500">Loading…</p>}
      {b && (
        <>
          <PageHeader
            title={b.fileName}
            description={`Uploaded ${formatDateTime(b.createdAt)} by ${b.createdBy?.name ?? '—'}`}
            actions={
              <Badge tone={IMPORT_STATUS_TONE[b.status]}>
                {humanize(b.status)}
              </Badge>
            }
          />

          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Rows in file" value={b.totalRows} />
            {b.status === 'COMPLETED' ? (
              <Stat label="Imported ✓" value={b.importedRows} tone="green" />
            ) : (
              <Stat
                label="Valid (will import)"
                value={b.validRows}
                tone="green"
              />
            )}
            <Stat label="Invalid" value={b.invalidRows} tone="red" />
            <Stat
              label={b.skippedRows ? 'Duplicate / skipped' : 'Duplicate'}
              value={b.duplicateRows + b.skippedRows}
              tone="yellow"
            />
          </div>

          {b.ignoredColumns.length > 0 && (
            <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Ye columns ignore hue (CRM me field nahi):{' '}
              <b>{b.ignoredColumns.join(', ')}</b>
            </p>
          )}

          {b.status === 'PREVIEW' && (
            <ConfirmPanel
              batch={b}
              onConfirm={(body) => action('confirm', body)}
              onCancel={() => {
                if (
                  window.confirm(
                    'Ye preview cancel karein? Kuch import nahi hoga.',
                  )
                )
                  void action('cancel');
              }}
            />
          )}

          {RUNNING.includes(b.status) && (
            <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 p-5">
              <p className="mb-2 font-semibold text-sky-900">
                ⏳ Import chal raha hai… (background me — page band kar sakte
                ho)
              </p>
              <ProgressBar
                done={b.importedRows + b.skippedRows}
                total={b.validRows}
                label="processed"
              />
            </div>
          )}

          {b.status === 'COMPLETED' && (
            <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-5 text-sm text-green-900">
              <p className="font-semibold">
                ✓ {b.importedRows.toLocaleString('en-IN')} customers add ho gaye
                {b.finishedAt && ` · ${formatDateTime(b.finishedAt)}`}
              </p>
              <p className="mt-1">
                Ab ye Start Calling (assignment engine) me available hain
                {b.campaign && (
                  <>
                    {' '}
                    · campaign{' '}
                    <Link
                      href={`/campaigns/${b.campaign.id}`}
                      className="font-medium underline"
                    >
                      {b.campaign.name}
                    </Link>
                  </>
                )}
                {b.tag && (
                  <>
                    {' '}
                    · tag{' '}
                    <Link
                      href={`/customers?tagId=${b.tag.id}`}
                      className="font-medium underline"
                    >
                      {b.tag.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
          )}

          {b.status === 'FAILED' && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              <p className="font-semibold">Import fail ho gaya: {b.error}</p>
              <p className="mt-1">
                {b.importedRows} customers ban chuke the. Retry wahin se aage
                chalega (duplicate nahi banenge).
              </p>
              <Button className="mt-3" onClick={() => action('retry')}>
                ↻ Retry
              </Button>
            </div>
          )}

          {b.status === 'CANCELLED' && (
            <p className="mb-5 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              Ye preview cancel hua — kuch import nahi hua.
            </p>
          )}

          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Rows</h2>
            {problems > 0 && (
              <a
                href={`/api/imports/${b.id}/problems.csv`}
                className="text-sm text-indigo-600 hover:underline"
              >
                ⬇ Download {problems} problem rows (CSV)
              </a>
            )}
          </div>
          <ImportRowsTable
            key={b.status}
            batchId={b.id}
            statuses={
              b.status === 'PREVIEW' || b.status === 'CANCELLED'
                ? ['VALID', 'INVALID', 'DUPLICATE']
                : ['IMPORTED', 'VALID', 'INVALID', 'DUPLICATE', 'SKIPPED']
            }
          />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number;
  tone?: 'slate' | 'green' | 'red' | 'yellow';
}) {
  const color = {
    slate: 'text-slate-900',
    green: 'text-green-700',
    red: 'text-red-700',
    yellow: 'text-amber-700',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>
        {value.toLocaleString('en-IN')}
      </p>
    </div>
  );
}

/** Preview ke baad: optional campaign / tag → Import */
function ConfirmPanel({
  batch,
  onConfirm,
  onCancel,
}: {
  batch: ImportBatch;
  onConfirm: (body: { campaignId?: string; tagId?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const campaigns = useApi<Campaign[]>('/campaigns');
  const tags = useApi<Tag[]>('/tags');
  const [campaignId, setCampaignId] = useState('');
  const [tagId, setTagId] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="mb-5 rounded-lg border border-indigo-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Step 2 — check & confirm</h2>
      <p className="mt-1 text-sm text-slate-600">
        Neeche rows check karo. Confirm karte hi <b>{batch.validRows}</b> valid
        customers background me add honge; invalid / duplicate rows chhod di
        jaayengi.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Add to campaign (optional)">
          <Select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">— None —</option>
            {campaigns.data
              ?.filter((c) => c.status !== 'COMPLETED')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({humanize(c.status)})
                </option>
              ))}
          </Select>
        </Field>
        <Field
          label="Tag (optional)"
          hint="Baad me is batch ke customers filter karne ke liye"
        >
          <Select value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">— None —</option>
            {tags.data
              ?.filter((t) => t.isActive)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel preview
        </Button>
        <Button
          disabled={saving || batch.validRows === 0}
          onClick={async () => {
            setSaving(true);
            await onConfirm({
              campaignId: campaignId || undefined,
              tagId: tagId || undefined,
            });
            setSaving(false);
          }}
        >
          {saving
            ? 'Starting…'
            : `Import ${batch.validRows.toLocaleString('en-IN')} customers →`}
        </Button>
      </div>
    </div>
  );
}
