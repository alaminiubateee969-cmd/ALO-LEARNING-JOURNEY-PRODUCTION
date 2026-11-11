/**
 * Authentication for both applications served by this Next.js app.
 *
 * 1. ALO Learning Journey admin console (learn.aloeducation.com): a single
 *    administrator authenticated with next-auth credentials (ADMIN_EMAIL +
 *    scrypt ADMIN_PASSWORD_HASH, optional SMS OTP). Route handlers call
 *    `requireOwner()`; `middleware.ts` enforces the session in production.
 * 2. MarketingOS / AI-workforce (`/dashboard`, integrated in PR #27): multi-user
 *    JWT bearer tokens (`createToken` / `verifyToken` / `getSessionUser`) backed
 *    by the `User` table, signed with JWT_SECRET.
 *
 * The two systems are independent; neither accepts the other's credentials.
 */
import { scryptSync, timingSafeEqual } from "node:crypto";
import { getServerSession } from "next-auth";
import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { consumeAdminOtp } from "@/lib/admin-otp";
import {
  isAdminAuthenticationConfigured,
  isAdminOtpRequired,
} from "@/lib/auth-config";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

export { isAdminOtpRequired };
export const DEV_OWNER_ID = "dev-admin";

function safeEqualText(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * Password hashes use `scrypt$<base64url salt>$<base64url hash>`.
 * Credentials are configured out-of-band; there is no built-in password.
 */
export function verifyAdminCredentials(email: string, password: string): boolean {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const encodedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!configuredEmail || !encodedHash || !email || !password) return false;
  if (!safeEqualText(email.trim().toLowerCase(), configuredEmail)) return false;

  const [algorithm, encodedSalt, encodedExpected] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedExpected) return false;
  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expected = Buffer.from(encodedExpected, "base64url");
    if (salt.length < 16 || expected.length < 32 || expected.length > 128) return false;
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isAdminAuthConfigured(): boolean {
  return isAdminAuthenticationConfigured();
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "production" ? undefined : "alo-local-development-only-secret"),
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "ALO administrator",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "SMS one-time code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email ?? "";
        const password = credentials?.password ?? "";
        if (!isAdminAuthenticationConfigured() || !verifyAdminCredentials(email, password)) return null;
        if (isAdminOtpRequired() && !await consumeAdminOtp(credentials?.otp ?? "")) return null;
        return {
          id: DEV_OWNER_ID,
          name: "ALO Administrator",
          email: process.env.ADMIN_EMAIL!.trim().toLowerCase(),
          role: "admin",
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = DEV_OWNER_ID;
        (token as any).ownerId = DEV_OWNER_ID;
        (token as any).role = "admin";
      }
      return token;
    },
    async session({ session, token }): Promise<Session> {
      (session as any).userId = (token as any).ownerId || DEV_OWNER_ID;
      (session as any).role = (token as any).role || "admin";
      if (session.user) session.user.name = "ALO Administrator";
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};

/**
 * Resolve the single configured administrator after auth. In development only,
 * API work may use a local preview owner when auth is intentionally unconfigured.
 * A production process with incomplete authentication always fails closed.
 */
export async function requireOwner(): Promise<{ ownerId: string; role: string }> {
  if (!isAdminAuthenticationConfigured()) {
    if (process.env.NODE_ENV !== "production") return { ownerId: DEV_OWNER_ID, role: "admin" };
    const error = new Error("ADMIN_AUTH_NOT_CONFIGURED");
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    const error = new Error("UNAUTHORIZED");
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
  return { ownerId: DEV_OWNER_ID, role: "admin" };
}

// ═══════════════════════════════════════════════════════════════════════════
// MarketingOS JWT authentication
// ═══════════════════════════════════════════════════════════════════════════
// ─── JWT Secret (MUST be set in production) ───────────────────────────────────

let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    // Development-only fallback — never used in production
    _jwtSecret = new TextEncoder().encode('dev-only-jwt-secret-do-not-use-in-prod');
  } else {
    _jwtSecret = new TextEncoder().encode(secret);
  }
  return _jwtSecret;
}

// ─── Password Hashing (bcryptjs) ─────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const LEGACY_SALT = 'marketing-os-salt-2024';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Detects whether a hash is bcrypt or legacy SHA-256.
 * bcrypt hashes start with "$2"; legacy hashes are 64-char hex strings.
 */
function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

/** Legacy SHA-256 hash used before migration to bcrypt. */
async function legacyHash(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + LEGACY_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a password against both bcrypt and legacy SHA-256 hashes.
 * Returns { valid, needsUpgrade } — if needsUpgrade is true, the caller
 * should re-hash the password with bcrypt and persist the new hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (isLegacyHash(hash)) {
    // Legacy verification
    const computed = await legacyHash(password);
    return computed === hash;
  }
  return bcrypt.compare(password, hash);
}

/** Returns true if the stored hash needs to be upgraded to bcrypt. */
export function passwordNeedsUpgrade(hash: string): boolean {
  return isLegacyHash(hash);
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export const ROLES = [
  'super_admin',
  'company_owner',
  'admin',
  'manager',
  'social_media_manager',
  'content_manager',
  'seo_manager',
  'ai_agent_manager',
  'customer_support',
  'team_member',
  'client_user',
  'viewer',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  company_owner: 'Company Owner',
  admin: 'Admin',
  manager: 'Manager',
  social_media_manager: 'Social Media Manager',
  content_manager: 'Content Manager',
  seo_manager: 'SEO Manager',
  ai_agent_manager: 'AI Agent Manager',
  customer_support: 'Customer Support',
  team_member: 'Team Member',
  client_user: 'Client User',
  viewer: 'Viewer',
};

// ─── JWT Token ───────────────────────────────────────────────────────────────

export async function createToken(payload: { userId: string; email: string; role: string; companyId?: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

// ─── Permission Check ────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  company_owner: 90,
  admin: 80,
  manager: 70,
  social_media_manager: 60,
  content_manager: 60,
  seo_manager: 60,
  ai_agent_manager: 60,
  customer_support: 50,
  team_member: 40,
  client_user: 30,
  viewer: 20,
};

export function hasPermission(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

// ─── Session User Extraction (used by api-middleware) ───────────────────────

export interface SessionUser {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  companyId: string;
  role: string;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    let token: string | null | undefined = authHeader?.replace('Bearer ', '');

    // Fallback: check cookie
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/mos_token=([^;]+)/);
      token = match ? match[1] : null;
    }

    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    return {
      userId: payload.userId || '',
      email: payload.email || '',
      isSuperAdmin: payload.role === 'super_admin',
      companyId: payload.companyId || '',
      role: payload.role || '',
    };
  } catch {
    return null;
  }
}
