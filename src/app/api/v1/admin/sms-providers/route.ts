/**
 * GET /api/v1/admin/sms-providers
 *
 * Returns the SMS provider chain status — which providers are configured,
 * their from-numbers, and whether real delivery is enabled.
 * Super admin only.
 */
import { NextRequest } from 'next/server';
import { getSessionContext, unauthorized, forbidden, ok } from '@/lib/v1-middleware';
import { getSmsProviderStatus } from '@/lib/sms-provider-chain';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const providers = getSmsProviderStatus();
  const anyConfigured = providers.some((p) => p.configured);

  return ok({
    anyProviderConfigured: anyConfigured,
    deliveryStatus: anyConfigured ? 'live' : 'simulation',
    providers,
    warning: anyConfigured
      ? null
      : 'No SMS provider configured. SMS routes will mark messages as simulated (no real delivery). Set TWILIO_*, HTTPSMS_*, TELNYX_*, or DOMOVINA_SMS_* env vars to enable.',
    docs: {
      twilio: 'https://www.twilio.com/docs/sms',
      httpsms: 'https://httpsms.com/docs',
      telnyx: 'https://developers.telnyx.com/docs/api/v2/messaging',
      domovina: 'https://github.com/domovinatv/sms.domovina.ai',
    },
  });
}
