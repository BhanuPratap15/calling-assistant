'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { AppNotification } from '@/lib/types';
import { Icon } from '@/components/ui/icons';
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
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${open ? 'bg-slate-100 text-slate-900' : ''}`}
      >
        <Icon name="bell" className="h-[18px] w-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-pop-in absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              Notifications
            </p>
            <button
              onClick={readAll}
              className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
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
                  className={`relative block w-full border-b border-slate-50 px-4 py-3 pl-7 text-left hover:bg-slate-50 ${n.readAt ? '' : 'bg-indigo-50/40'}`}
                >
                  {!n.readAt && (
                    <span className="absolute left-3 top-[18px] h-2 w-2 rounded-full bg-indigo-500" />
                  )}
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
