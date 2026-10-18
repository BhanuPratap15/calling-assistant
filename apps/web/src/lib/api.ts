/**
 * Backend API call karne ka ek hi tarika — poore frontend me yahi use karo.
 *   const user = await api<AuthUser>('/auth/me');
 *   await api('/customers', { method: 'POST', body: { name, phone } });
 *   await api('/imports', { method: 'POST', body: formData }); // file upload
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
  'The server is not responding right now. Please try again; if it keeps happening, contact your administrator.';

/** Request browser se nikli hi nahi / beech me toot gayi → zyaadatar staff ka internet (server tak pahunchi hi nahi) */
export const NETWORK_ERROR_MESSAGE =
  'Could not reach the server — please check your internet connection and try again.';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T = void>(
  path: string,
  { method = 'GET', body }: ApiOptions = {},
): Promise<T> {
  let res: Response;
  try {
    // FormData (file upload) → browser khud "multipart/form-data; boundary=..." header lagata hai
    const isForm = body instanceof FormData;
    res = await fetch(`/api${path}`, {
      method,
      headers:
        body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    // Network hi fail — staff ka internet / WiFi drop (server logs me request dikhti hi nahi)
    throw new ApiError(0, NETWORK_ERROR_MESSAGE, true);
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
