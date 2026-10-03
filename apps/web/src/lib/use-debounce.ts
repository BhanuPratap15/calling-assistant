'use client';

import { useEffect, useState } from 'react';

/**
 * Debounce: user type karna band kare, tab value update ho (default 400ms).
 * Har letter pe API call nahi — "rahul" type karne pe 5 ki jagah 1 request.
 */
export function useDebounce<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer); // naya letter aaya → purana timer cancel
  }, [value, delayMs]);
  return debounced;
}
