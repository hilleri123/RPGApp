import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isPublicPath, safeReturnTo } from './app/lib/auth/routes'

const PUBLIC_FILE = /\.(.*)$/

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function isTokenExpired(token: string): boolean {
  try {
    const segment = token.split('.')[1];
    if (!segment) return true;
    const payload = JSON.parse(decodeBase64Url(segment));
    // Без exp токен считаем невалидным: undefined < number даёт false,
    // то есть наивная проверка признала бы его живым навсегда.
    if (typeof payload?.exp !== 'number') return true;
    return payload.exp < Date.now() / 1000;
  } catch {
    return true;
  }
}

function hasValidSession(accessToken: string | undefined, refreshToken: string | undefined): boolean {
  if (accessToken && !isTokenExpired(accessToken)) {
    return true;
  }
  return Boolean(refreshToken);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next()
  }

  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  const sessionOk = hasValidSession(accessToken, refreshToken)

  if (pathname === '/login') {
    // Уводим с /login только при живом access_token.
    // Один refresh_token (часто «протухший» при падении API) создавал петлю:
    // /login → / → «Войти» → /login → …
    const accessOk = Boolean(accessToken && !isTokenExpired(accessToken))
    if (accessOk) {
      const next = safeReturnTo(request.nextUrl.searchParams.get('next'), '/')
      return NextResponse.redirect(new URL(next, request.url))
    }
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  if (sessionOk) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  const returnPath = pathname + request.nextUrl.search
  url.searchParams.set('next', safeReturnTo(returnPath, '/'))
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
