/**
 * POST /api/v1/auth/mfa/disable
 *
 * Disable MFA for the authenticated user. Requires the current TOTP code to
 * be supplied as a re-authentication factor — a logged-in session alone is
 * not sufficient. This is the same security posture as GitHub / Google /
 * Stripe's "remove 2FA" flow.
 *
 * Body:
 *   { "code": "123456" }
 *
 * On success: the MfaSecret row is deleted (or marked disabled). Future
 * logins will not prompt for a TOTP code.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { decryptSecret } from '@/lib/vault';
import { verifyTotp } from '@/lib/totp';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || !body.code) return badRequest('code is required');

  const code = String(body.code).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return badRequest('code must be 6 digits');

  const mfa = await db.mfaSecret.findUnique({ where: { userId: ctx.userId } });
  if (!mfa) return notFound('mfa not configured for this user');
  if (!mfa.isEnabled) return badRequest('mfa is not enabled');

  let secret: string;
  try {
    secret = decryptSecret(mfa.secretCipher);
  } catch (e) {
    console.error('[mfa/disable] decrypt failed:', e);
    return badRequest('secret corrupted');
  }

  if (!verifyTotp(secret, code)) {
    return badRequest('invalid_code', 'TOTP code did not match');
  }

  await db.mfaSecret.update({
    where: { userId: ctx.userId },
    data: {
      isEnabled: false,
      enabledAt: null,
      lastUsedAt: new Date(),
    },
  });

  await emitEvent({
    type: 'mfa.disabled',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'mfa_secret',
    resourceId: mfa.id,
    title: 'MFA disabled',
    description: `MFA was disabled for ${ctx.email}`,
    metadata: { disabledAt: new Date().toISOString() },
  });

  return ok({ enabled: false });
}
