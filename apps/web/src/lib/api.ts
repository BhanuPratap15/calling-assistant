/**
 * Backend API call karne ka ek hi tarika — poore frontend me yahi use karo.
 *   const user = await api<AuthUser>('/auth/me');
 *   await api('/customers', { method: 'POST', body: { name, phone } });
 *
 * - Cookie (login token) browser automatically bhejta hai (same origin)
 * - Error aaye to ApiError throw hota hai: status + backend ka message
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** true = backend tak pahunche hi nahi (API band hai / crash / network) */
    public readonly unreachable = false,
  ) {
    super(message);
  }
}

export const BACKEND_UNREACHABLE_MESSAGE =
  'Backend (API) se connect nahi ho paya. Check karein: `npm run dev:api` chal raha hai aur uske terminal me koi error to nahi?';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T = void>(
  path: string,
  { method = 'GET', body }: ApiOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    // Network hi fail (Next.js server bhi band, ya internet nahi)
    throw new ApiError(0, BACKEND_UNREACHABLE_MESSAGE, true);
  }

  if (!res.ok) {
    // NestJS error format: { statusCode, message: string | string[], error }
    const data = await res.json().catch(() => null);
    // 5xx + JSON nahi = response NestJS ka nahi, Next.js proxy ka hai → backend tak pahunche hi nahi
    if (res.status >= 500 && data === null) {
      throw new ApiError(res.status, BACKEND_UNREACHABLE_MESSAGE, true);
    }
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }

  // 204 No Content → koi body nahi
  return (res.status === 204 ? undefined : await res.json()) as T;
}
