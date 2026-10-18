/**
 * Media Token — Edge + Node compatible HMAC token for gating media URLs.
 * Used by middleware (Edge) to verify, and by API routes (Node) to mint.
 *
 * Uses Web Crypto API so the same code runs in both runtimes.
 */

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET || 'dev-insecure-do-not-use-in-prod';
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  // Convert to hex (Edge-compatible — Buffer may not exist in pure Edge)
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.slice(0, 32);
}

/** Mint a short-lived (1-day) signed token for a media path. */
export async function mintMediaToken(pathname: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  return hmac(`${pathname}|${day}`);
}

/** Verify a signed media token for a path (allows today or yesterday). */
export async function verifyMediaToken(token: string, pathname: string): Promise<boolean> {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  for (const d of [today, yesterday]) {
    const day = d.toISOString().slice(0, 10);
    const expected = await hmac(`${pathname}|${day}`);
    if (token.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
      if (diff === 0) return true;
    }
  }
  return false;
}
