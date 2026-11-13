import { headers } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_BRANDING, type Branding } from './branding';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/**
 * Server pe (root layout / metadata): is request ke host ka client branding.
 * API ko original host X-Forwarded-Host me bhejte hain (API usi se client pehchaanta hai).
 * React cache: ek request me ek hi fetch (layout + generateMetadata dono).
 */
export const getBranding = cache(async (): Promise<Branding> => {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  try {
    const res = await fetch(`${API_URL}/api/branding`, {
      headers: { 'x-forwarded-host': host },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return { ...DEFAULT_BRANDING, status: 'NOT_FOUND' };
    if (!res.ok) return DEFAULT_BRANDING;
    return {
      ...DEFAULT_BRANDING,
      ...((await res.json()) as Partial<Branding>),
    };
  } catch {
    return DEFAULT_BRANDING; // API band → default look (login page apna error dikhayega)
  }
});
