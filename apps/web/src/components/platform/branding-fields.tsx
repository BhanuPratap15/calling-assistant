'use client';

import { useState } from 'react';
import { Field, Input } from '@/components/ui/form';
import { readImageFile } from '@/lib/platform';
import {
  LOGIN_STYLES,
  SIDEBAR_STYLES,
  THEME_PRESETS,
  paletteFor,
} from '@/lib/theme';

export interface BrandingValue {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  themePreset: string;
  primaryColor: string | null;
  sidebarStyle: string;
  loginStyle: string;
  supportEmail: string;
  supportPhone: string;
}

/** Branding + theme ke saare inputs (naya client + edit dono me) */
export function BrandingFields({
  value,
  onChange,
}: {
  value: BrandingValue;
  onChange: (patch: Partial<BrandingValue>) => void;
}) {
  const [imageError, setImageError] = useState<string | null>(null);

  async function pick(field: 'logoUrl' | 'faviconUrl', file: File | undefined) {
    setImageError(null);
    if (!file) return;
    try {
      onChange({ [field]: await readImageFile(file) });
    } catch (e) {
      setImageError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Brand name"
          hint="Shown in the header, login page and browser tab"
        >
          <Input
            required
            maxLength={60}
            value={value.brandName}
            onChange={(e) => onChange({ brandName: e.target.value })}
          />
        </Field>
        <Field label="Tagline (login page)" hint="Optional">
          <Input
            maxLength={200}
            placeholder="Every call counts."
            value={value.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['logoUrl', 'Logo', 'Square PNG / SVG works best · max 300 KB'],
            [
              'faviconUrl',
              'Favicon (browser tab)',
              'Optional — logo is used if empty',
            ],
          ] as const
        ).map(([field, label, hint]) => (
          <div key={field}>
            <p className="mb-1.5 text-sm font-medium text-slate-700">{label}</p>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                {value[field] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={value[field]!}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">none</span>
                )}
              </span>
              <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50">
                Upload
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                  className="sr-only"
                  onChange={(e) => {
                    void pick(field, e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {value[field] && (
                <button
                  type="button"
                  onClick={() => onChange({ [field]: null })}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
          </div>
        ))}
      </div>
      {imageError && <p className="text-sm text-red-600">{imageError}</p>}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Theme colour</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => {
            const selected = !value.primaryColor && value.themePreset === key;
            return (
              <button
                key={key}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={selected}
                onClick={() =>
                  onChange({ themePreset: key, primaryColor: null })
                }
                className={`h-9 w-9 rounded-full ring-offset-2 ${selected ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200 hover:ring-slate-400'}`}
                style={{
                  background: `linear-gradient(135deg, ${preset.palette[400]}, ${preset.palette[700]})`,
                }}
              />
            );
          })}
          <label
            title="Custom colour"
            className={`relative flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-xs font-medium ring-offset-2 ${value.primaryColor ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200 hover:ring-slate-400'}`}
          >
            <span
              className="h-5 w-5 rounded-full"
              style={{
                background: value.primaryColor ?? paletteFor(value)[600],
              }}
            />
            Custom
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={value.primaryColor ?? paletteFor(value)[600]}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {value.primaryColor
            ? `Custom ${value.primaryColor.toUpperCase()} — all shades are generated automatically`
            : THEME_PRESETS[value.themePreset]?.label}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Sidebar</p>
          <div className="flex gap-2">
            {Object.entries(SIDEBAR_STYLES).map(([k, label]) => (
              <Choice
                key={k}
                selected={value.sidebarStyle === k}
                onClick={() => onChange({ sidebarStyle: k })}
              >
                {label}
              </Choice>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Login page</p>
          <div className="flex gap-2">
            {Object.entries(LOGIN_STYLES).map(([k, label]) => (
              <Choice
                key={k}
                selected={value.loginStyle === k}
                onClick={() => onChange({ loginStyle: k })}
              >
                {label.split(' (')[0]}
              </Choice>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Support email" hint="Shown on the login page (optional)">
          <Input
            type="email"
            value={value.supportEmail}
            onChange={(e) => onChange({ supportEmail: e.target.value })}
          />
        </Field>
        <Field label="Support phone" hint="Optional">
          <Input
            maxLength={30}
            value={value.supportPhone}
            onChange={(e) => onChange({ supportPhone: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm ${selected ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
    >
      {children}
    </button>
  );
}

/** API body: "" → null */
export function brandingPayload(v: BrandingValue) {
  return {
    brandName: v.brandName.trim(),
    tagline: v.tagline.trim() || null,
    logoUrl: v.logoUrl,
    faviconUrl: v.faviconUrl,
    themePreset: v.themePreset,
    primaryColor: v.primaryColor,
    sidebarStyle: v.sidebarStyle,
    loginStyle: v.loginStyle,
    supportEmail: v.supportEmail.trim() || null,
    supportPhone: v.supportPhone.trim() || null,
  };
}
