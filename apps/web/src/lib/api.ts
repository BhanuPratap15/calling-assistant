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
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T = void>(
  path: string,
  { method = 'GET', body }: ApiOptions = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (!res.ok) {
    // NestJS error format: { statusCode, message: string | string[], error }
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : (data?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }

  // 204 No Content → koi body nahi
  return (res.status === 204 ? undefined : await res.json()) as T;
}
