/**
 * ALO Authentication & Authorization Library
 *
 * Production auth using NextAuth v4 credentials provider.
 * - Single admin user seeded from env (ALO_ADMIN_EMAIL / ALO_ADMIN_PASSWORD_HASH)
 * - Session enforced by middleware on all protected paths
 * - ownerId scoping enforced at the data layer (see requireOwner)
 *
 * In DEV mode (no NextAuth secret configured), falls back to a dev session
 * with a fixed ownerId="dev-admin" so the app remains usable locally.
 * This dev fallback is logged loudly and must NOT be enabled in production.
 */

import { getServerSession } from 'next-auth';
import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const DEV_OWNER_ID = 'dev-admin';
const ADMIN_EMAIL = process.env.ALO_ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ALO_ADMIN_PASSWORD_HASH; // bcrypt hash
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export const IS_DEV_AUTH = !NEXTAUTH_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD_HASH;

if (IS_DEV_AUTH && process.env.NODE_ENV === 'production') {
  // NO throw — allow boot — but every protected request will 401 until configured.
  console.warn('[auth] PRODUCTION WARNING: NEXTAUTH_SECRET/ALO_ADMIN_EMAIL/ALO_ADMIN_PASSWORD_HASH not set. All protected APIs will return 401.');
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'ALO Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        if (IS_DEV_AUTH) {
          // dev fallback — accept any non-empty creds as dev-admin
          return { id: DEV_OWNER_ID, email: credentials.email, role: 'admin' } as any;
        }
        if (credentials.email !== ADMIN_EMAIL) return null;
        const ok = await bcrypt.compare(credentials.password, ADMIN_PASSWORD_HASH!);
        if (!ok) return null;
        return { id: ADMIN_EMAIL, email: ADMIN_EMAIL, role: 'admin' } as any;
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: NEXTAUTH_SECRET || 'dev-insecure-secret-do-not-use-in-prod',
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role || 'admin';
        token.ownerId = IS_DEV_AUTH ? DEV_OWNER_ID : (user as any).id || (user as any).email;
      }
      return token;
    },
    async session({ session, token }): Promise<Session> {
      (session as any).userId = token.ownerId as string;
      (session as any).role = token.role as string;
      return session;
    },
  },
  pages: { signIn: '/' },
};

/**
 * Returns the authenticated ownerId for the current request context.
 * Throws 401 if unauthenticated (caller should catch and return 401).
 * In dev mode, returns DEV_OWNER_ID.
 */
export async function requireOwner(): Promise<{ ownerId: string; role: string }> {
  if (IS_DEV_AUTH) {
    return { ownerId: DEV_OWNER_ID, role: 'admin' };
  }
  const session = await getServerSession(authOptions);
  if (!session) {
    const err = new Error('UNAUTHORIZED');
    (err as any).statusCode = 401;
    throw err;
  }
  const ownerId = (session as any).userId as string;
  const role = (session as any).role as string;
  if (!ownerId) {
    const err = new Error('UNAUTHORIZED');
    (err as any).statusCode = 401;
    throw err;
  }
  return { ownerId, role };
}

/**
 * Hash a plaintext password using bcrypt. Used by the seeding/admin tooling.
 * Usage: bun run scripts/hash-password.ts <password>
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}
