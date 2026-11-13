'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_BRANDING, type Branding } from './branding';

const BrandingContext = createContext<Branding>(DEFAULT_BRANDING);

/** Root layout (server) se aayi branding — kisi bhi component me: useBranding() */
export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding;
  children: ReactNode;
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): Branding {
  return useContext(BrandingContext);
}
