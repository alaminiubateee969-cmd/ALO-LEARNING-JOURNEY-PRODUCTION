/**
 * v1 API middleware — auth + tenant context + JSON helpers.
 *
 * Every /api/v1/* route calls getSessionContext() which:
 *   1. Extracts the JWT from the Authorization header (preferred) or
 *      mos_token cookie (fallback for browser sessions).
 *   2. Verifies the JWT via src/lib/auth.ts (HS256, 7-day expiry).
 *   3. Looks up the User + their CompanyUser row to get companyId + role.
 *
 * Returns null when unauthenticated — routes respond 401 with a JSON
 * body shaped to match the Integration Setup Agent contract:
 *   { "authenticated": false, "redirect": "/login" }
 */
import { NextResponse } from 'next/server';
import { getSessionUser, hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';

export interface V1SessionContext {
  userId: string;
  email: string;
  role: string;
  companyId: string;
  isSuperAdmin: boolean;
  authenticated: true;
}

export interface V1SessionNone {
  authenticated: false;
  redirect: string;
}

export async function getSessionContext(request: Request): Promise<V1SessionContext | V1SessionNone> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return { authenticated: false, redirect: '/login' };
  }

  // Resolve companyId from the companyUser link
  let companyId = sessionUser.companyId;
  if (!companyId) {
    const link = await db.companyUser.findFirst({
      where: { userId: sessionUser.userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!link) return { authenticated: false, redirect: '/login' };
    companyId = link.companyId;
  }

  return {
    userId: sessionUser.userId,
    email: sessionUser.email,
    role: sessionUser.role,
    companyId,
    isSuperAdmin: sessionUser.isSuperAdmin,
    authenticated: true,
  };
}

/** Build a 401 JSON response with the standard unauth envelope. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ authenticated: false, redirect: '/login' }, { status: 401 });
}

/** Build a 403 JSON response with the standard forbidden envelope. */
export function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: 'forbidden', message }, { status: 403 });
}

/** Build a 400 JSON response. */
export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: 'bad_request', message, details }, { status: 400 });
}

/** Build a 404 JSON response. */
export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: 'not_found', message }, { status: 404 });
}

/** Build a 200 OK JSON response. */
export function ok(data: unknown): NextResponse {
  return NextResponse.json({ ok: true, data });
}

/** Build a 503 JSON response (capability not configured). */
export function notConfigured(capability: string, hint?: string): NextResponse {
  return NextResponse.json(
    { error: 'not_configured', capability, hint: hint || 'configure the required env var to enable this capability' },
    { status: 503 }
  );
}

/**
 * Require a minimum role for the route. Returns the session if allowed,
 * otherwise returns the forbidden response (use `await` + early return).
 */
export async function requireRole(
  request: Request,
  minimumRole: string
): Promise<V1SessionContext | NextResponse> {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) {
    return unauthorized();
  }
  // super_admin bypasses all role checks
  if (ctx.isSuperAdmin) return ctx;
  if (!hasPermission(ctx.role, minimumRole)) {
    return forbidden(`requires ${minimumRole} role`);
  }
  return ctx;
}
