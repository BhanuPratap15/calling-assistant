'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import {
  formatDuration,
  LIVE_STATUSES,
  SESSION_LABEL,
  SESSION_TONE,
} from '@/lib/telephony';
import type { CallSession, TelephonyConfig } from '@/lib/types';
import { useApi } from '@/lib/use-api';
import { useInterval } from '@/lib/use-interval';

const RECORDING_WAIT_MS = 2 * 60_000;

/**
 * Calling screen ka 📞 — provider ke through call (design doc 17).
 *   manual provider → tel: link khulta hai (mobile / softphone)
 *   api provider    → provider call lagata hai; status webhooks se aata hai (yahan har 2s poll)
 */
export function DialPanel({
  phone,
  alternatePhone,
}: {
  phone: string;
  alternatePhone: string | null;
}) {
  const config = useApi<TelephonyConfig>('/telephony/config');
  const list = useApi<{ sessions: CallSession[] }>('/calling/sessions');
  const [error, setError] = useState<string | null>(null);
  const [dialing, setDialing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const sessions = list.data?.sessions ?? [];
  const live = sessions.find((s) => LIVE_STATUSES.includes(s.status));

  const last = sessions[0];

  // Poll: call chal rahi hai, YA abhi khatam hui aur recording abhi aani hai
  // (providers recording aksar call ke kuch sec / min baad alag webhook me bhejte hain)
  useInterval(() => {
    const awaitingRecording =
      last?.status === 'COMPLETED' &&
      !last.recordingUrl &&
      last.endedAt !== null &&
      Date.now() - new Date(last.endedAt).getTime() < RECORDING_WAIT_MS;
    if (live || awaitingRecording) list.reload();
  }, 2000);
  useInterval(() => {
    if (live?.status === 'ANSWERED') setNow(Date.now());
  }, 1000);

  async function dial(number: 'primary' | 'alternate') {
    setDialing(true);
    setError(null);
    try {
      const r = await api<{ session: CallSession; dialUrl: string | null }>(
        '/calling/dial',
        { method: 'POST', body: { number } },
      );
      if (r.dialUrl) window.location.href = r.dialUrl; // tel: → phone app
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDialing(false);
    }
  }

  const isApi = config.data?.mode === 'api';

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => dial('primary')}
          disabled={dialing || Boolean(live)}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-mono text-lg font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          📞 {phone}
        </button>
        {alternatePhone && (
          <Button
            variant="secondary"
            onClick={() => dial('alternate')}
            disabled={dialing || Boolean(live)}
          >
            📞 Alternate {alternatePhone}
          </Button>
        )}
        {config.data && (
          <span className="text-xs text-slate-400">
            via {config.data.provider}
          </span>
        )}
      </div>

      {live && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900"
        >
          <Badge tone={SESSION_TONE[live.status]}>
            {SESSION_LABEL[live.status]}
          </Badge>
          {live.status === 'ANSWERED' && live.answeredAt && (
            <span className="font-mono">
              {formatDuration(
                Math.max(
                  0,
                  Math.round(
                    (now - new Date(live.answeredAt).getTime()) / 1000,
                  ),
                ),
              )}
            </span>
          )}
          <span className="text-sky-700">{live.toNumber}</span>
        </div>
      )}

      {/* Provider ne bataya call nahi lagi → form me wahi outcome chunne ka hint */}
      {isApi &&
        !live &&
        last &&
        ['NO_ANSWER', 'BUSY', 'FAILED'].includes(last.status) && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Provider: <b>{SESSION_LABEL[last.status]}</b>
            {last.failReason && ` (${last.failReason})`} — call form me matching
            outcome chuniye, ya dobara try karein.
          </p>
        )}

      {sessions.length > 0 && (
        <ul
          className="space-y-1 text-xs text-slate-600"
          aria-label="Call attempts"
        >
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">
                {new Date(s.createdAt).toLocaleTimeString('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <Badge tone={SESSION_TONE[s.status]}>
                {SESSION_LABEL[s.status]}
              </Badge>
              <span className="font-mono">{s.toNumber}</span>
              {s.durationSec !== null && s.status !== 'DIALED' && (
                <span>⏱ {formatDuration(s.durationSec)}</span>
              )}
              {s.recordingUrl && (
                <a
                  href={s.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  ▶ Recording
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage message={error ?? list.error} />
    </div>
  );
}
