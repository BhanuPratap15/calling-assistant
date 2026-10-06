'use client';

import { useEffect, useState } from 'react';
import { CallForm } from '@/components/calling/call-form';
import { DialPanel } from '@/components/calling/dial-panel';
import { CustomerProfileView } from '@/components/customers/customer-profile-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import type { CallConfig, CurrentAssignment } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Assistant ka main kaam (design doc section 5):
 *   Start Calling → ek customer → call → form → Save & Next → agla customer
 * Phase 10 (ADR 0015):
 *   Save & Stop   → call save, agla customer NAHI, assistant BREAK pe (shift khatam / break)
 *   Stop calling  → bina call ke customer chhodo (dial nahi kiya ho tab) → wapas queue
 */
export default function CallingPage() {
  const config = useApi<CallConfig>('/call-config');
  const { refreshUser } = useAuth(); // header ka availability (ON_CALL / AVAILABLE) sync
  // undefined = abhi load ho raha; null = koi current customer nahi
  const [current, setCurrent] = useState<CurrentAssignment | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Page khulte hi: pehle se koi customer khula hai? (refresh / browser band hone ke baad bhi wahi)
  useEffect(() => {
    api<{ current: CurrentAssignment | null }>('/calling/current')
      .then((r) => setCurrent(r.current))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function startCalling() {
    setStarting(true);
    setError(null);
    setMessage(null);
    try {
      const r = await api<{ current: CurrentAssignment | null }>(
        '/calling/next',
        { method: 'POST' },
      );
      setCurrent(r.current);
      void refreshUser();
      if (!r.current)
        setMessage(
          'Abhi koi customer available nahi hai. Thodi der baad try karein.',
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function saveAndNext(body: Record<string, unknown>) {
    let r: { current: CurrentAssignment | null };
    try {
      r = await api('/calling/complete', { method: 'POST', body });
    } catch (e) {
      // 409 = ye customer ab aapke paas nahi (manager ne reassign/cancel kiya) → screen refresh
      if (e instanceof ApiError && e.status === 409) {
        const fresh = await api<{ current: CurrentAssignment | null }>(
          '/calling/current',
        );
        setCurrent(fresh.current);
        setMessage(
          'Ye customer manager ne kisi aur ko de diya. Screen refresh ho gayi.',
        );
        return;
      }
      throw e; // baaki errors form me dikhenge
    }
    setCurrent(r.current);
    setMessage(
      body.stop
        ? 'Call saved ✓ — aap Break pe hain. Wapas aakar Start Calling dabaiye.'
        : r.current
          ? 'Call saved ✓ — agla customer'
          : 'Call saved ✓ — aur customers abhi nahi hain',
    );
    if (body.stop) void refreshUser(); // header: BREAK
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Bina call ke current customer chhodo (galti se khula / shift khatam) */
  async function stopCalling() {
    if (
      !window.confirm(
        'Is customer ko bina call ke chhod dein? Ye wapas queue me jayega aur aap Break pe ho jayenge.',
      )
    )
      return;
    setError(null);
    setMessage(null);
    try {
      await api('/calling/release', { method: 'POST', body: {} });
      setCurrent(null);
      setMessage('Customer chhod diya — aap Break pe hain.');
      void refreshUser();
    } catch (e) {
      setError((e as Error).message); // 409: dial ho chuka → form save karo
    }
  }

  return (
    <div>
      <PageHeader
        title="Calling"
        description="Ek customer, ek waqt — form poora karke hi agla milega"
      />
      <ErrorMessage message={error ?? config.error} />
      {message && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}

      {current === undefined || !config.data ? (
        <p className="text-slate-500">Loading…</p>
      ) : current === null ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-600">
            Ready? Agla customer lene ke liye button dabaiye.
          </p>
          <Button
            onClick={startCalling}
            disabled={starting}
            className="mt-5 px-8 py-3 text-base"
          >
            {starting ? 'Finding customer…' : '▶ Start Calling'}
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              Current customer
              {(current.source === 'MANUAL' ||
                current.source === 'DISTRIBUTED') && (
                <Badge tone="yellow">Assigned by manager</Badge>
              )}
              {current.source === 'FOLLOW_UP' && (
                <Badge tone="red">Follow-up</Badge>
              )}
              {current.campaign && (
                <Badge tone="indigo">📣 {current.campaign.name}</Badge>
              )}
              <Button
                variant="ghost"
                onClick={stopCalling}
                className="ml-auto text-xs"
                title="Dial nahi kiya ho tab — customer wapas queue me"
              >
                ⏹ Stop calling
              </Button>
            </div>
            {current.campaign?.script && (
              <details
                open
                className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950"
              >
                <summary className="cursor-pointer font-semibold">
                  📜 Script — {current.campaign.name}
                </summary>
                <p className="mt-2 whitespace-pre-wrap">
                  {current.campaign.script}
                </p>
              </details>
            )}
            {current.followUp && (
              // Design doc 8.1: "New assistant sees original request + full history"
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">
                  ⏰ Follow-up due {formatDateTime(current.followUp.dueAt)}
                </p>
                <p className="mt-1">
                  Promised by <b>{current.followUp.originalOwner.name}</b>
                  {current.followUp.escalationCount > 0 &&
                    ` · escalated ${current.followUp.escalationCount}×`}
                </p>
                {current.followUp.sourceCall.userResponse && (
                  <p className="mt-1">
                    Customer ne kaha tha: “
                    {current.followUp.sourceCall.userResponse}”
                  </p>
                )}
              </div>
            )}
            <CustomerProfileView
              customer={current.customer}
              canEditTags
              phoneAction={
                // key = naya customer → attempts list fresh
                <DialPanel
                  key={current.id}
                  phone={current.customer.phone}
                  alternatePhone={current.customer.alternatePhone}
                />
              }
            />
          </div>
          {/* key = naye customer pe form fresh banega */}
          <CallForm
            key={current.id}
            config={config.data}
            campaignFields={current.campaign?.fields}
            onSubmit={saveAndNext}
          />
        </div>
      )}
    </div>
  );
}
