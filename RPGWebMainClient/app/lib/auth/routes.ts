/** Paths reachable without a session cookie (middleware + client guards). */
const PUBLIC_EXACT = new Set(['/', '/login', '/observer', '/contacts']);

const PUBLIC_PREFIXES = ['/auth/link', '/session-obs'];

/** `next` targets that must not be used after login (redirect loops). */
const BLOCKED_RETURN_PATHS = new Set(['/login', '/auth/link']);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function safeReturnTo(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;

  const pathOnly = trimmed.split('?')[0]?.split('#')[0] ?? trimmed;
  if (BLOCKED_RETURN_PATHS.has(pathOnly)) return fallback;

  for (const blocked of BLOCKED_RETURN_PATHS) {
    if (pathOnly === blocked || pathOnly.startsWith(`${blocked}/`)) {
      return fallback;
    }
  }

  return trimmed;
}
