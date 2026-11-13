import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (Next 16 me "middleware" ka naya naam) — har page request se PEHLE chalta hai.
 * Sirf "optimistic" check: cookie hai ya nahi. Token sahi hai ya nahi, wo backend check karta hai.
 *
 * Client (staff) app:
 *  - cookie nahi + protected page → /login
 *  - cookie hai + /login → /dashboard
 * Platform panel (/platform/*) — alag cookie (platform_token):
 *  - cookie nahi → /platform/login ;  cookie hai + /platform/login → /platform
 */
const AUTH_COOKIE = 'access_token';
const PLATFORM_COOKIE = 'platform_token';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/platform' || pathname.startsWith('/platform/')) {
    const hasPlatform = request.cookies.has(PLATFORM_COOKIE);
    const isPlatformLogin = pathname === '/platform/login';
    if (!hasPlatform && !isPlatformLogin)
      return NextResponse.redirect(new URL('/platform/login', request.url));
    if (hasPlatform && isPlatformLogin)
      return NextResponse.redirect(new URL('/platform', request.url));
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(AUTH_COOKIE);
  const isLoginPage = pathname === '/login';

  if (!hasSession && !isLoginPage) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname); // login ke baad wapas yahin
    return NextResponse.redirect(url);
  }
  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // API, Next.js ki internal files, aur static files pe proxy mat chalao
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
