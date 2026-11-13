'use client';

import { brandInitials } from '@/lib/branding';
import { useBranding } from '@/lib/branding-context';

/**
 * Client ka logo (white-label). Logo upload nahi hua → brand rang me initials.
 * size: tile ka size (px).
 */
export function BrandMark({
  size = 36,
  className = '',
  logoUrl,
  name,
}: {
  size?: number;
  className?: string;
  /** Preview ke liye override (platform panel) — warna current client */
  logoUrl?: string | null;
  name?: string;
}) {
  const brand = useBranding();
  const logo = logoUrl === undefined ? brand.logoUrl : logoUrl;
  const label = name ?? brand.brandName;
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data: URL (DB se), next/image ki zaroorat nahi
      <img
        src={logo}
        alt={label}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-xl bg-white object-contain ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-700 font-semibold text-white shadow-lg shadow-indigo-900/30 ring-1 ring-white/15 ${className}`}
    >
      {brandInitials(label)}
    </span>
  );
}
