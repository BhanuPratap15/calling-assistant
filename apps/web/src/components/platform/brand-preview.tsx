'use client';

import type { CSSProperties } from 'react';
import { BrandMark } from '@/components/brand-mark';
import { themeVariables } from '@/lib/theme';

export interface BrandDraft {
  brandName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  themePreset: string;
  primaryColor?: string | null;
  sidebarStyle: string;
  loginStyle?: string;
}

/**
 * Live preview: client ka app kaisa dikhega (sidebar + header + button + login).
 * Theme CSS variables sirf is box pe (scoped) — baaki page pe asar nahi.
 */
export function BrandPreview({ draft }: { draft: BrandDraft }) {
  const vars = themeVariables(draft) as CSSProperties;
  const name = draft.brandName || 'Your brand';
  return (
    <div style={vars} className="space-y-3">
      {/* App */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-[var(--page-bg)] shadow-card">
        <div className="flex h-56">
          <div className="flex w-36 flex-col bg-[linear-gradient(180deg,var(--sidebar-bg)_0%,var(--sidebar-bg-2)_100%)] p-2.5">
            <div className="mb-3 flex items-center gap-2">
              <BrandMark
                size={22}
                logoUrl={draft.logoUrl ?? null}
                name={name}
              />
              <span className="truncate text-[11px] font-semibold text-[var(--sidebar-title)]">
                {name}
              </span>
            </div>
            {['Dashboard', 'Start Calling', 'Follow-ups', 'Customers'].map(
              (item, i) => (
                <div
                  key={item}
                  className={`mb-0.5 flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] ${
                    i === 1
                      ? 'bg-[var(--sidebar-active)] font-medium text-[var(--sidebar-text-active)]'
                      : 'text-[var(--sidebar-text)]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${i === 1 ? 'bg-[var(--sidebar-icon-active)]' : 'bg-[var(--sidebar-icon)]'}`}
                  />
                  {item}
                </div>
              ),
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-9 items-center justify-center border-b border-slate-200/70 bg-white/80">
              <span className="truncate bg-[linear-gradient(110deg,var(--brand-700),var(--brand-500))] bg-clip-text text-xs font-bold text-transparent">
                {name}
              </span>
            </div>
            <div className="space-y-2 p-3">
              <div className="grid grid-cols-3 gap-1.5">
                {['Calls', 'Connect', 'Talk'].map((k, i) => (
                  <div
                    key={k}
                    className="rounded-md border border-slate-200 bg-white p-1.5"
                  >
                    <p className="text-[8px] text-slate-500">{k}</p>
                    <p className="text-[11px] font-semibold text-slate-900">
                      {['1,826', '55%', '66h'][i]}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex h-12 items-end gap-1 rounded-md border border-slate-200 bg-white p-1.5">
                {[40, 65, 50, 80, 60, 90, 70, 85].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="flex-1 rounded-sm bg-indigo-500"
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <span className="rounded-md bg-indigo-600 px-2 py-1 text-[9px] font-medium text-white">
                  Save &amp; Next →
                </span>
                <span className="rounded-md bg-indigo-50 px-2 py-1 text-[9px] font-medium text-indigo-700">
                  Follow-up
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Login */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-card">
        {draft.loginStyle === 'centered' ? (
          <div className="flex h-28 flex-col items-center justify-center gap-1 bg-[var(--page-bg)]">
            <BrandMark size={24} logoUrl={draft.logoUrl ?? null} name={name} />
            <span className="text-[11px] font-semibold text-slate-900">
              {name}
            </span>
            <span className="h-5 w-32 rounded-md border border-slate-200 bg-white" />
            <span className="h-5 w-32 rounded-md bg-indigo-600" />
          </div>
        ) : (
          <div className="grid h-28 grid-cols-2">
            <div className="flex flex-col justify-between bg-[linear-gradient(160deg,var(--brand-950)_0%,var(--brand-900)_55%,var(--brand-800)_100%)] p-2.5">
              <div className="flex items-center gap-1.5">
                <BrandMark
                  size={18}
                  logoUrl={draft.logoUrl ?? null}
                  name={name}
                />
                <span className="truncate text-[10px] font-semibold text-white">
                  {name}
                </span>
              </div>
              <span className="line-clamp-2 text-[10px] font-semibold text-white/90">
                {draft.tagline || 'Every call counts.'}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 bg-white">
              <span className="h-4 w-24 rounded border border-slate-200" />
              <span className="h-4 w-24 rounded border border-slate-200" />
              <span className="h-4 w-24 rounded bg-indigo-600" />
            </div>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-slate-400">Live preview</p>
    </div>
  );
}
