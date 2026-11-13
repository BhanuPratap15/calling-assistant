'use client';

import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { ErrorMessage, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  DOMAIN_LABEL,
  DOMAIN_TONE,
  type OrgDetail,
  type OrgDomain,
} from '@/lib/platform';
import { Section } from './section';

interface DnsCheck {
  hostname: string;
  aRecords: string[];
  cnameRecords: string[];
  pointsHere: boolean | null;
}

export function OrgDomainsTab({
  org,
  onChanged,
}: {
  org: OrgDetail;
  onChanged: () => void;
}) {
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dns, setDns] = useState<Record<string, DnsCheck | string>>({});
  const base = `/platform/organizations/${org.id}/domains`;

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    await run('add', async () => {
      await api(base, { method: 'POST', body: { hostname: hostname.trim() } });
      setHostname('');
    });
  }

  async function checkDns(d: OrgDomain) {
    setDns((m) => ({ ...m, [d.id]: 'checking' }));
    try {
      const res = await api<DnsCheck>(`${base}/${d.id}/dns`);
      setDns((m) => ({ ...m, [d.id]: res }));
    } catch (e) {
      setDns((m) => ({ ...m, [d.id]: (e as Error).message }));
    }
  }

  const { serverIps, cnameTarget } = org.dns;

  return (
    <div className="space-y-6">
      <Section
        title="Web addresses"
        description="The client's users open the CRM on any of these. SSL (HTTPS) is issued automatically by the server once DNS points here."
      >
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {org.domains.map((d) => {
            const check = dns[d.id];
            return (
              <div key={d.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://${d.hostname}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-slate-900 hover:text-indigo-700 hover:underline"
                  >
                    {d.hostname}
                  </a>
                  <Badge tone="gray">
                    {d.type === 'SUBDOMAIN' ? 'built-in subdomain' : 'custom'}
                  </Badge>
                  {d.isPrimary && <Badge tone="indigo">primary</Badge>}
                  <Badge tone={DOMAIN_TONE[d.status]}>
                    {DOMAIN_LABEL[d.status]}
                  </Badge>
                  <div className="ml-auto flex flex-wrap gap-1">
                    <Button variant="ghost" onClick={() => void checkDns(d)}>
                      Check DNS
                    </Button>
                    {!d.isPrimary && (
                      <Button
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          run(d.id, () =>
                            api(`${base}/${d.id}/primary`, { method: 'POST' }),
                          )
                        }
                      >
                        Make primary
                      </Button>
                    )}
                    {d.status !== 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          run(d.id, () =>
                            api(`${base}/${d.id}/recheck`, { method: 'POST' }),
                          )
                        }
                      >
                        Retry SSL
                      </Button>
                    )}
                    {d.type === 'CUSTOM' && (
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        disabled={busy !== null}
                        onClick={() =>
                          window.confirm(`Remove ${d.hostname}?`) &&
                          run(d.id, () =>
                            api(`${base}/${d.id}`, { method: 'DELETE' }),
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                {d.error && (
                  <p className="mt-1 text-xs text-red-600">{d.error}</p>
                )}
                {d.checkedAt && (
                  <p className="mt-1 text-xs text-slate-400">
                    SSL checked {formatDateTime(d.checkedAt)}
                  </p>
                )}
                {check && (
                  <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                    {typeof check === 'string'
                      ? check === 'checking'
                        ? 'Checking DNS…'
                        : check
                      : [
                          check.aRecords.length
                            ? `A: ${check.aRecords.join(', ')}`
                            : null,
                          check.cnameRecords.length
                            ? `CNAME: ${check.cnameRecords.join(', ')}`
                            : null,
                          !check.aRecords.length && !check.cnameRecords.length
                            ? 'No DNS records found yet'
                            : null,
                          check.pointsHere === true
                            ? '✓ points to this server'
                            : check.pointsHere === false
                              ? '✗ does not point to this server yet'
                              : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                  </p>
                )}
              </div>
            );
          })}
          {!org.domains.length && (
            <p className="p-3 text-sm text-slate-500">No domains yet.</p>
          )}
        </div>

        <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
          <Input
            required
            placeholder="crm.clientcompany.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value.toLowerCase())}
            className="w-72"
          />
          <Button type="submit" disabled={busy !== null}>
            Add domain
          </Button>
        </form>
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      </Section>

      <Section title="DNS setup for the client">
        <p className="text-sm text-slate-600">
          Ask the client to add one of these records at their domain provider
          (GoDaddy, Hostinger, Cloudflare…):
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {cnameTarget && (
            <DnsRow
              type="CNAME"
              value={cnameTarget}
              note="recommended for sub-domains like crm.client.com"
            />
          )}
          {serverIps.map((ip) => (
            <DnsRow key={ip} type="A" value={ip} note="for a root domain" />
          ))}
          {!cnameTarget && !serverIps.length && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              Server IP not configured — set PLATFORM_SERVER_IP (and
              PLATFORM_BASE_DOMAIN) on the API.
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

function DnsRow({
  type,
  value,
  note,
}: {
  type: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
      <Badge tone="indigo">{type}</Badge>
      <span className="font-mono text-slate-900">{value}</span>
      <CopyButton text={value} label="Copy" />
      <span className="text-xs text-slate-500">{note}</span>
    </div>
  );
}
