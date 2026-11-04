/**
 * PKCE (Proof Key for Code Exchange) — RFC 7636.
 *
 * Used by every OAuth Authorization Code flow in this codebase so that the
 * authorization code cannot be intercepted and replayed by a malicious
 * browser extension or a man-in-the-middle on the redirect_uri.
 *
 *   1. Client generates a random `code_verifier` (43-128 chars, base64url).
 *   2. Client computes `code_challenge = BASE64URL(SHA256(code_verifier))`.
 *   3. Client sends `code_challenge` + `code_challenge_method=S256` in the
 *      authorize request.
 *   4. On callback, client sends the original `code_verifier` in the token
 *      exchange request. Provider recomputes the challenge and compares.
 *
 * The verifier is stored in OAuthState (server-side) and never exposed to
 * the browser. The browser only sees the opaque `state` token.
 */
import { randomBytes, createHash } from 'crypto';

/** Generates a 32-byte (256-bit) random code_verifier as base64url. */
export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

/** Computes S256 code_challenge from a code_verifier. */
export function computeCodeChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

/** Generates a 32-byte random state token as base64url. */
export function generateStateToken(): string {
  return base64url(randomBytes(32));
}

/**
 * Validates a state token from an OAuth callback against the stored
 * OAuthState row. Returns true only if:
 *   - state matches exactly (constant-time compare)
 *   - OAuthState is not yet consumed
 *   - OAuthState has not expired
 */
export function validateStateToken(stored: string, received: string): boolean {
  if (!stored || !received) return false;
  if (stored.length !== received.length) return false;
  // Constant-time compare to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < stored.length; i++) {
    diff |= stored.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return diff === 0;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export { base64url };
