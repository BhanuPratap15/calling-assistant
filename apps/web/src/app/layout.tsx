import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { BrandingProvider } from '@/lib/branding-context';
import { getBranding } from '@/lib/branding.server';
import { themeCss } from '@/lib/theme';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/** Browser tab: client ka naam + favicon (white-label) */
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBranding();
  return {
    title: { default: brand.brandName, template: `%s · ${brand.brandName}` },
    description: brand.tagline ?? `${brand.brandName} — calling CRM`,
    icons: brand.faviconUrl
      ? { icon: brand.faviconUrl }
      : brand.logoUrl
        ? { icon: brand.logoUrl }
        : undefined,
  };
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Host → client branding (server pe) → theme CSS variables pehli paint se hi
  const branding = await getBranding();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style
          id="brand-theme"
          dangerouslySetInnerHTML={{ __html: themeCss(branding) }}
        />
      </head>
      <body className="min-h-full">
        <BrandingProvider branding={branding}>
          <AuthProvider>{children}</AuthProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
