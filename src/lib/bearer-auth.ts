/**
 * MarketingOS JWT bearer verification used by the request gateway (`src/proxy.ts`).
 *
 * The app serves two independent login systems:
 *   - the ALO admin console, authenticated with a next-auth session cookie, and
 *   - MarketingOS, authenticated with `Authorization: Bearer <JWT>` signed by
 *     `createToken()` in `src/lib/auth.ts` with `JWT_SECRET`.
 *
 * The gateway must not let an arbitrary `Authorization: Bearer <anything>`
 * header skip the session check, so it verifies the signature here before
 * handing the request to a route handler. This module deliberately imports
 * nothing but `jose` so it stays free of `node:crypto`, Prisma, and next-auth.
 */
import { jwtVerify } from "jose";

export interface BearerSubject {
  userId: string;
  companyId?: string;
  role?: string;
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
