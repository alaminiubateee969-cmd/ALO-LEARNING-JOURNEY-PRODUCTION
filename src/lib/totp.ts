/**
 * TOTP — RFC 6238 Time-Based One-Time Password.
 *
 * Implemented natively with Node's `crypto` module so we don't need the
 * `otpauth` npm dependency. SHA-1 HMAC over the 30-second time step, 6-digit
 * code, base32-encoded secrets — fully compatible with Google Authenticator,
 * 1Password, Authy, Bitwarden, etc.
 *
 * Reference: RFC 6238 §4 (algorithm) + RFC 4648 §5 (base32 alphabet).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Generate a new random TOTP secret (32 base32 chars ≈ 160 bits). */
export function generateTotpSecret(lengthBytes = 20): string {
  const bytes = randomBytes(lengthBytes);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Decode a base32 string back into bytes (RFC 4648). */
function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Compute the 6-digit TOTP code for the given secret + Unix time. */
export function computeTotp(secret: string, unixSeconds = Math.floor(Date.now() / 1000)): string {
  const counter = Math.floor(unixSeconds / STEP_SECONDS);
  const buf = Buffer.alloc(8);
  // Write counter as big-endian 64-bit
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  const code = binary % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

/**
 * Verify a user-supplied TOTP code against the secret. Allows ±1 time step
 * (30s window on either side) to absorb clock drift between the user's phone
 * and the server.
 *
 * Uses `timingSafeEqual` so the comparison is constant-time.
 */
export function verifyTotp(secret: string, code: string, unixSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!code || !/^\d{4,8}$/.test(code)) return false;
  const padded = code.padStart(DIGITS, '0');
  for (let offset = -1; offset <= 1; offset++) {
    const expected = computeTotp(secret, unixSeconds + offset * STEP_SECONDS);
    if (expected.length === padded.length && timingSafeEqual(Buffer.from(expected), Buffer.from(padded))) {
      return true;
    }
  }
  return false;
}

/**
 * Build the `otpauth://` provisioning URI that mobile authenticator apps scan
 * as a QR code. Format documented in Google Authenticator Key URI Format.
 */
export function buildTotpUri({
  issuer,
  accountName,
  secret,
}: {
  issuer: string;
  accountName: string;
  secret: string;
}): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Generate `count` single-use backup codes (8 chars, alphanumeric). */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(4);
    const code = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8)
      .toUpperCase();
    codes.push(code);
  }
  return codes;
}
