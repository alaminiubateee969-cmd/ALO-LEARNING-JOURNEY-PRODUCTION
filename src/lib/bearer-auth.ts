/**
 * MarketingOS JWT bearer verification used by the request gateway (`src/proxy.ts`).
 *
 * The app serves two independent login systems:
 *   - the ALO admin console, authenticated with a next-auth session cookie, and
 *   - MarketingOS, authenticated with `Authorization: Bearer <JWT>` signed by
 *     `createToken()` in `src/lib/auth.ts` with `JWT_SECRET`.
 *
 * The gateway must:
 *   1. verify the JWT signature before handing a request to a route handler (an
 *      arbitrary `Authorization: Bearer <anything>` header must never bypass
 *      authentication), and
 *   2. only accept a MarketingOS bearer token on routes that actually implement
 *      MarketingOS / v1 tenant-scoped authentication — never on single-tenant
 *      ALO console routes (`/api/backups`, `/api/seed`, `/api/export`,
 *      `/api/settings`, `/api/family*`, `/api/media/*`, etc.).
 *
 * This module deliberately imports nothing but `jose` so it stays free of
 * `node:crypto`, Prisma, and next-auth.
 */
import { jwtVerify } from "jose";

export interface BearerSubject {
  userId: string;
  companyId?: string;
  role?: string;
}

const ALO_ONLY_CONTENT_SUBPATHS = new Set([
  "/api/content/brief",
  "/api/content/generate",
  "/api/content/package",
]);

const MARKETINGOS_EXACT_OR_TREE_ROOTS = [
  "/api/activity-feed",
  "/api/ai-agents",
  "/api/analytics",
  "/api/announcements",
  "/api/assignments",
  "/api/attendance",
  "/api/audit-logs",
  "/api/auth/me",
  "/api/batches",
  "/api/campaigns",
  "/api/competitors",
  "/api/crm/contacts",
  "/api/crm/deals",
  "/api/crm/tickets",
  "/api/dashboard",
  "/api/departments",
  "/api/designations",
  "/api/employees",
  "/api/exams",
  "/api/expenses",
  "/api/fee-structures",
  "/api/fees",
  "/api/institution",
  "/api/keywords",
  "/api/leave",
  "/api/leave-types",
  "/api/market-intelligence",
  "/api/messages",
  "/api/notifications",
  "/api/partners",
  "/api/payments",
  "/api/programs",
  "/api/salary",
  "/api/schedule",
  "/api/scraper",
  "/api/seo",
  "/api/social-accounts",
  "/api/students",
  "/api/subjects",
  "/api/team",
  "/api/tools",
  "/api/users",
  "/api/workflows",
];

const MARKETINGOS_SUBTREE_ONLY_PREFIXES = [
  "/api/feeds/",
  "/api/leads/",
  "/api/settings/",
  "/api/sms/",
  "/api/social/",
  "/api/v1/",
  "/api/voip/",
  "/api/workforce/",
];

/**
 * Return true iff `pathname` is an API route that authenticates a MarketingOS
 * bearer JWT (directly or via shared route dispatch) and scopes queries to the
 * caller's tenant. Single-tenant ALO administrator routes return false so they
 * always require the NextAuth administrator session.
 */
export function isMarketingOsApiPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (!normalized.startsWith("/api/")) return false;

  if (normalized.startsWith("/api/ai/")) {
    return normalized !== "/api/ai/local-status" && !normalized.startsWith("/api/ai/local-status/");
  }

  if (normalized === "/api/content" || normalized.startsWith("/api/content/")) {
    for (const aloPath of ALO_ONLY_CONTENT_SUBPATHS) {
      if (normalized === aloPath || normalized.startsWith(`${aloPath}/`)) return false;
    }
    return true;
  }

  if (normalized === "/api/crm/leads" || /^\/api\/crm\/leads\/[^/]+$/.test(normalized)) {
    return true;
  }

  for (const prefix of MARKETINGOS_SUBTREE_ONLY_PREFIXES) {
    if (normalized.startsWith(prefix)) return true;
  }

  for (const root of MARKETINGOS_EXACT_OR_TREE_ROOTS) {
    if (normalized === root || normalized.startsWith(`${root}/`)) return true;
  }

  return false;
}

/** Extract the credential from a `Bearer <token>` header, or null. */
export function readBearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return match ? match[1] : null;
}

/**
 * Verify a `Bearer` header and return its subject.
 *
 * Returns null for a missing header, a missing `JWT_SECRET`, a bad signature,
 * an expired token, or a token without a `userId` claim. Callers must treat
 * null as "not authenticated".
 */
export async function verifyMarketingOsBearer(
  header: string | null | undefined,
): Promise<BearerSubject | null> {
  const token = readBearerToken(header);
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const userId = typeof payload.userId === "string" ? payload.userId : "";
    if (!userId) return null;
    return {
      userId,
      companyId: typeof payload.companyId === "string" ? payload.companyId : undefined,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  } catch {
    return null;
  }
}
