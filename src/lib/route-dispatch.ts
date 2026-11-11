/**
 * Shared-path dispatch between the two applications served by this app.
 *
 * The ALO Learning Journey admin console and the MarketingOS dashboard
 * (integrated in PR #27) both call a handful of identical API paths:
 * `/api/analytics`, `/api/dashboard`, `/api/notifications`, `/api/crm/leads`
 * and `/api/crm/leads/[id]`. PR #27 overwrote the ALO handlers at those paths,
 * which broke the ALO console. Both contracts are now served from one path:
 *
 *   - MarketingOS always authenticates with `Authorization: Bearer <JWT>`
 *     (see `src/lib/api-client.ts`), so those requests go to the MarketingOS
 *     handler, which verifies the JWT itself and returns 401 when it is invalid.
 *   - Every other request goes to the ALO handler, which is protected by the
 *     next-auth session enforced in `src/middleware.ts` (production).
 *
 * This only selects an implementation; it never grants access. Middleware runs
 * first for every request, and each handler keeps its own authentication.
 */
export function isMarketingOsRequest(request: Request): boolean {
  return /^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "");
}

/** 405 for a method that only one of the two applications implements. */
export function methodNotAllowed(allow: string[]): Response {
  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: allow.join(", ") },
  });
}
