'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/**
 * GET data load karne ka hook — loading / error / reload sab ek saath.
 *   const { data, loading, error, reload } = useApi<Staff[]>('/staff?role=ASSISTANT');
 * `path` badla → automatically dobara load. `null` path = abhi load mat karo.
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0); // reload() isko badhata hai
  const requestKey = path === null ? null : `${path}#${version}`;

  // Result ke saath yaad rakho ki wo KIS request ka hai
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (requestKey === null || path === null) return;
    let cancelled = false; // purani request ka jawab late aaye to ignore (race condition)
    api<T>(path)
      .then(
        (data) =>
          !cancelled && setResult({ key: requestKey, data, error: null }),
      )
      .catch(
        (err: Error) =>
          !cancelled &&
          setResult((prev) => ({
            key: requestKey,
            data: prev?.data ?? null,
            error: err.message,
          })),
      );
    return () => {
      cancelled = true;
    };
  }, [path, requestKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return {
    data: result?.data ?? null, // naya load hote waqt purana data dikhta rahe
    error: result?.key === requestKey ? result.error : null,
    // loading = jo request chahiye uska result abhi nahi aaya
    loading: requestKey !== null && result?.key !== requestKey,
    reload,
  };
}

/** Object se URL query string: { a: 1, b: '', c: undefined } → "?a=1" */
export function toQuery(
  params: Record<string, string | number | boolean | undefined>,
) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}
