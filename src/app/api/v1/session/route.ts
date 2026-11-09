/**
 * GET /api/v1/session
 *
 * Returns the authenticated user's session context for the Integration
 * Setup Agent. The agent calls this in Phase 0 to know who it's talking
 * to without asking for credentials in chat.
 *
 * Response (authenticated):
 *   { "user_id": "...", "workspace_id": "...", "project_id": null,
 *     "language": "bn", "authenticated": true }
 *
 * Response (unauthenticated):
 *   { "authenticated": false, "redirect": "/login" }
 *
 * `language` defaults to "bn" (Bengali) per the Integration Setup Agent
 * specification. Override with the `Accept-Language` header ("en" for
 * English).
 */
import { NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) {
    return Response.json(ctx, { status: 401 });
  }

  // Language negotiation: Accept-Language header wins, else default to
  // Bengali (bn) per the Integration Setup Agent spec.
  const acceptLang = request.headers.get('accept-language') || '';
  const language = acceptLang.toLowerCase().startsWith('en') ? 'en' : 'bn';

  return Response.json({
    user_id: ctx.userId,
    workspace_id: ctx.companyId, // workspace = company in this codebase
    project_id: null, // projects are an optional grouping layer (not yet modeled)
    language,
    authenticated: true,
    email: ctx.email,
    role: ctx.role,
    is_super_admin: ctx.isSuperAdmin,
  });
}
