/**
 * MFA Verify — verify TOTP code + enable MFA.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { decryptSecret } from '@/lib/vault';
import { createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

function verifyTotp(secret: string, code: string, window: number = 1): boolean {
  const time = Math.floor(Date.now() / 1000);
  const key = Buffer.from(secret, 'base64');
  for (let offset = -window; offset <= window; offset++) {
    const counter = Math.floor(time / 30) + offset;
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offsetByte = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offsetByte] & 0x7f) << 24) | (hmac[offsetByte + 1] << 16) | (hmac[offsetByte + 2] << 8) | hmac[offsetByte + 3];
    const candidate = (binary % 1000000).toString().padStart(6, '0');
    if (candidate === code) return true;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body?.code || !/^\d{6}$/.test(body.code)) {
    return badRequest('code must be a 6-digit string');
  }

  const mfaRow = await db.mfaSecret.findUnique({ where: { userId: ctx.userId } });
  if (!mfaRow) return badRequest('No MFA setup found. Call /api/v1/auth/mfa/setup first.');

  const secret = decryptSecret(mfaRow.secretCipher);
  if (!verifyTotp(secret, body.code)) {
    return badRequest('Invalid TOTP code');
  }

  await db.mfaSecret.update({
    where: { userId: ctx.userId },
    data: { isEnabled: true, enabledAt: new Date(), lastUsedAt: new Date() },
  });

  return ok({ enabled: true, message: 'MFA enabled. Future logins will require the TOTP code.' });
}
