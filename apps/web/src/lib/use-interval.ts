'use client';

import { useEffect, useRef } from 'react';

/**
 * Har `ms` me callback chalao (polling). Tab background me ho to skip — server load kam.
 * Real-time (WebSocket) baad me; abhi 30 sec polling kaafi hai.
 */
export function useInterval(callback: () => void, ms: number) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') saved.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms]);
}
