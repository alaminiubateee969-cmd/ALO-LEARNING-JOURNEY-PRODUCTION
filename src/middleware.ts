import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { verifyMediaToken } from '@/lib/media-token';

/**
 * ALO Production Middleware — authentication enforcement (Edge Runtime compatible).
 *
 * - Public paths: /, /_next/*, /api/auth/*, /api/health, /api/recovery/sweep (cron)
 * - Protected: /api/human-avatars, /api/avatar-video, /avatar-videos/*, etc.
 * - Media URLs signed with an HMAC token (Web Crypto API, Edge-compatible).
 *
 * In DEV_AUTH mode (NextAuth secret not configured), pass-through with header.
 */

const PUBLIC_API_PATHS = [
  '/api/health',
  '/api/auth',
  '/api/recovery/sweep',
];

const PUBLIC_STATIC_PREFIXES = [
  '/_next/',
  '/favicon.ico',
  '/login',
];

const PROTECTED_MEDIA_PREFIXES = [
  '/avatar-videos/',
  '/avatar-audio/',
  '/avatar-scenes/',
  '/avatar-thumbs/',
  '/avatars/',
];

const PROTECTED_API_PREFIXES = [
  '/api/human-avatars',
  '/api/avatar-video',
];

const DEV_AUTH = !process.env.NEXTAUTH_SECRET || !process.env.ALO_ADMIN_EMAIL || !process.env.ALO_ADMIN_PASSWORD_HASH;

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (PUBLIC_STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith('/api/recovery/sweep') && !DEV_AUTH) {
      const cronSecret = request.headers.get('x-cron-secret');
      if (cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized cron' }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  const isProtectedMedia = PROTECTED_MEDIA_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isProtectedMedia && !isProtectedApi) {
    return NextResponse.next();
  }

  if (DEV_AUTH) {
    const res = NextResponse.next();
    res.headers.set('x-alo-auth', 'dev-fallback');
    return res;
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return NextResponse.next();
  }

  if (isProtectedMedia) {
    const t = searchParams.get('t');
    if (t && (await verifyMediaToken(t, pathname))) {
      return NextResponse.next();
    }
  }

  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health).*)',
  ],
};
