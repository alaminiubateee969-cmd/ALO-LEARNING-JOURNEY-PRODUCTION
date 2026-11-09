/**
 * MFA Setup — generate TOTP secret + QR code.
 * Uses a minimal TOTP implementation (RFC 6238) without external deps.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { encryptSecret } from '@/lib/vault';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function generateTotpSecret(): string {
  // 20 bytes (160 bits) — RFC 4226 recommended length
  return randomBytes(20).toString('base64');
}

function totpUri(email: string, secret: string): string {
  const issuer = 'ALO%20Labs%20MarketingOS';
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret.replace(/=/g, '')}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  // Check if MFA already enabled
  const existing = await db.mfaSecret.findUnique({ where: { userId: ctx.userId } });
  if (existing?.isEnabled) {
    return badRequest('MFA already enabled. Disable first to re-setup.');
  }

  const secret = generateTotpSecret();
  const enc = encryptSecret(secret);
  const uri = totpUri(ctx.email, secret);

  // Save the secret (not yet enabled — verified in /verify step)
  await db.mfaSecret.upsert({
    where: { userId: ctx.userId },
    update: { secretCipher: enc.ciphertext, secretKeyVersion: enc.keyVersion, isEnabled: false },
    create: { userId: ctx.userId, secretCipher: enc.ciphertext, secretKeyVersion: enc.keyVersion, isEnabled: false },
  });

  return ok({
    secret, // returned once so user can manually enter if QR scan fails
    otpauth_uri: uri,
    qr_code_data_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`,
    next_step: 'POST /api/v1/auth/mfa/verify with a 6-digit TOTP code from your authenticator app',
  });
}
