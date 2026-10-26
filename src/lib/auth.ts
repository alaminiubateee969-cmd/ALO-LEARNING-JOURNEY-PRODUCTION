import { scryptSync, timingSafeEqual } from "node:crypto";
import { getServerSession } from "next-auth";
import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { consumeAdminOtp } from "@/lib/admin-otp";
import {
  isAdminAuthenticationConfigured,
  isAdminOtpRequired,
} from "@/lib/auth-config";

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
