'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { useInterval } from '@/lib/use-interval';

const POLL_MS = 30_000;

/** Header ka 🔔 — unread count har 30 sec, click → list, notification click → page + read */
export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api<{ count: number }>('/notifications/unread-count')
      .then((r) => setCount(r.count))
      .catch(() => undefined); // bell fail ho to app na tootey
  }, []);

  useEffect(refreshCount, [refreshCount]);
  useInterval(refreshCount, POLL_MS);

  // Bahar click → dropdown band
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    setItems(await api<AppNotification[]>('/notifications').catch(() => []));
  }

  async function openItem(n: AppNotification) {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(
        () => undefined,
      );
      refreshCount();
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    setItems(
      (list) =>
        list?.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })) ?? null,
    );
    setCount(0);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={toggle}
        aria-label={`Notifications (${count} unread)`}
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100"
      >
        🔔
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-96 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <p className="text-sm font-semibold text-slate-900">
              Notifications
            </p>
            <button
              onClick={readAll}
              className="text-xs text-indigo-600 hover:underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items === null && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">
                Loading…
              </li>
            )}
            {items?.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-400">
                No notifications
              </li>
            )}
            {items?.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openItem(n)}
                  className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${n.readAt ? '' : 'bg-indigo-50/60'}`}
                >
                  <p
                    className={`text-sm ${n.readAt ? 'text-slate-600' : 'font-medium text-slate-900'}`}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDateTime(n.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
