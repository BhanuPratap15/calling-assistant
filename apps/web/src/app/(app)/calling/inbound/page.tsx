'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CallForm } from '@/components/calling/call-form';
import { CustomerProfileView } from '@/components/customers/customer-profile-view';
import { Button } from '@/components/ui/button';
import { ErrorMessage, Field, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page-header';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { CallConfig, CustomerProfile } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/**
 * Customer ne khud call kiya (callback) — humne call kiya tha, uthaya nahi, baad me usne call back kiya.
 *   number daalo → customer + poori history → form → save (INBOUND call)
 * Assistant ka current customer (Calling screen) disturb nahi hota. Customer ka open follow-up
 * isi call se complete ho jaata hai (kisi ko dobara call nahi karna padta).
 */
export default function InboundCallPage() {
  const config = useApi<CallConfig>('/call-config');
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  // undefined = abhi search nahi kiya; null = is number ka customer nahi mila
  const [customer, setCustomer] = useState<CustomerProfile | null | undefined>(
    undefined,
  );
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const r = await api<{ customer: CustomerProfile | null }>(
        `/calling/inbound?phone=${encodeURIComponent(phone.trim())}`,
      );
      setCustomer(r.customer);
    } catch (err) {
      setCustomer(undefined);
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function save(body: Record<string, unknown>) {
    if (!customer) return;
    await api('/calling/inbound', {
      method: 'POST',
      body: { ...body, customerId: customer.id },
    }); // error → form me dikhega
    setMessage(`Incoming call saved ✓ — ${customer.name}`);
    setCustomer(undefined);
    setPhone('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Customer kisi ki Calling screen pe khula hai → wahi form bharega (server bhi 409 deta hai)
  const openWith = customer?.assignments.find(
    (a) => a.status === 'IN_PROGRESS',
  );

  return (
    <div>
      <PageHeader
        title="Incoming call"
        description="A customer called you back — find them by number and save what they said"
        actions={
          <Link
            href="/calling"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50"
          >
            ← Back to Calling
          </Link>
        }
      />
      <ErrorMessage message={error ?? config.error} />
      {message && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}

      <form
        onSubmit={search}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card"
      >
        <div className="min-w-56 flex-1">
          <Field
            label="Caller's phone number"
            hint="The full number, e.g. 98765 43210 or +91 98765 43210"
          >
            <Input
              type="tel"
              inputMode="tel"
              autoFocus
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" disabled={searching || !phone.trim()}>
          {searching ? 'Searching…' : 'Find customer'}
        </Button>
      </form>

      {customer === null && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No customer has this number. Check the number, or ask your Team Leader
          / Manager to add the customer and search again.
        </p>
      )}

      {customer && config.data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <CustomerProfileView customer={customer} />
          {openWith ? (
            <div className="h-fit rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
              {openWith.staff.id === user?.id ? (
                <>
                  This is your current customer.{' '}
                  <Link href="/calling" className="font-medium underline">
                    Save the call on the Calling screen
                  </Link>{' '}
                  instead.
                </>
              ) : (
                <>
                  <b>{openWith.staff.name}</b> has this customer open on their
                  Calling screen right now — ask them to save this call.
                </>
              )}
            </div>
          ) : (
            // key = naya customer → form fresh
            <CallForm
              key={customer.id}
              config={config.data}
              inbound
              onSubmit={save}
            />
          )}
        </div>
      )}
    </div>
  );
}
