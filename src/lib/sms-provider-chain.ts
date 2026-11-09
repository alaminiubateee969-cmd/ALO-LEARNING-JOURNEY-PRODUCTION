/**
 * SMS Provider Chain — real provider dispatch with safe fallback.
 *
 * Sends an SMS via the first configured provider, in priority order:
 *   1. Twilio  (env: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER)
 *   2. httpSMS (env: HTTPSMS_API_KEY + HTTPSMS_FROM_NUMBER)
 *   3. Telnyx  (env: TELNYX_API_KEY + TELNYX_CONNECTION_ID + TELNYX_FROM_NUMBER)
 *   4. sms.domovina.ai (env: DOMOVINA_SMS_API_URL + DOMOVINA_SMS_API_KEY)
 *
 * When NO provider is configured, the message is persisted as
 * `status='queued'` with `providerName='simulation'` and the caller
 * sees `{ simulated: true }` so the UI can label it accordingly. This
 * preserves the previous "simulate send" behaviour for dev environments
 * without falsely claiming a real delivery.
 *
 * Returns a SendResult describing what actually happened. The caller
 * is responsible for persisting the SmsMessage row.
 *
 * Per master directive: "Never send real marketing posts or bulk SMS
 * without explicit approval. Use authorized test accounts and test
 * recipients only." This module NEVER auto-enables real sends — the
 * env vars must be set explicitly by the operator.
 */
import { emitEvent } from './events';

export interface SendSmsInput {
  to: string;
  body: string;
  /** Optional: lead/contact/campaign link for audit trail */
  leadId?: string;
  contactId?: string;
  companyId: string;
  sentBy?: string;
  /** When true, skip ALL real providers — for tests. */
  forceSimulation?: boolean;
}

export interface SendSmsResult {
  /** What actually happened. */
  status: 'sent' | 'queued' | 'failed' | 'simulation';
  /** The SmsMessage row id (caller passes back). */
  smsId?: string;
  /** Which provider handled the send (or 'simulation'). */
  providerName: string;
  /** Provider's message id (for delivery receipts). */
  providerMessageId?: string;
  /** Real HTTP status from the provider (or 0 for simulation). */
  providerHttpStatus: number;
  /** Whether this was a simulated send (no real provider). */
  simulated: boolean;
  /** Error message when status='failed'. */
  error?: string;
}

/**
 * Send an SMS through the configured provider chain.
 *
 * Persist the SmsMessage row BEFORE calling this function with status='queued',
 * then UPDATE the row using the returned SendSmsResult.
 */
export async function sendSmsViaProvider(input: SendSmsInput): Promise<SendSmsResult> {
  // ─── 1. Twilio ────────────────────────────────────────────────────────────
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;
  if (!input.forceSimulation && twilioSid && twilioToken && twilioFrom) {
    try {
      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: input.to,
          From: twilioFrom,
          Body: input.body,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        return {
          status: data.status === 'queued' || data.status === 'sent' ? 'sent' : 'queued',
          providerName: 'twilio',
          providerMessageId: data.sid,
          providerHttpStatus: 200,
          simulated: false,
        };
      }
      return {
        status: 'failed',
        providerName: 'twilio',
        providerHttpStatus: res.status,
        simulated: false,
        error: `Twilio HTTP ${res.status}`,
      };
    } catch (e: any) {
      return {
        status: 'failed',
        providerName: 'twilio',
        providerHttpStatus: 0,
        simulated: false,
        error: e?.message?.slice(0, 200) || 'Twilio fetch failed',
      };
    }
  }

  // ─── 2. httpSMS (NdoleStudio) ─────────────────────────────────────────────
  const httpsmsKey = process.env.HTTPSMS_API_KEY;
  const httpsmsFrom = process.env.HTTPSMS_FROM_NUMBER;
  if (!input.forceSimulation && httpsmsKey && httpsmsFrom) {
    try {
      const res = await fetch('https://api.httpsms.com/v1/messages/send', {
        method: 'POST',
        headers: {
          'x-api-key': httpsmsKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: httpsmsFrom,
          to: input.to,
          text: input.body,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        return {
          status: 'sent',
          providerName: 'httpsms',
          providerMessageId: data.id || data.messageId,
          providerHttpStatus: 200,
          simulated: false,
        };
      }
      return {
        status: 'failed',
        providerName: 'httpsms',
        providerHttpStatus: res.status,
        simulated: false,
        error: `httpSMS HTTP ${res.status}`,
      };
    } catch (e: any) {
      return {
        status: 'failed',
        providerName: 'httpsms',
        providerHttpStatus: 0,
        simulated: false,
        error: e?.message?.slice(0, 200) || 'httpSMS fetch failed',
      };
    }
  }

  // ─── 3. Telnyx ────────────────────────────────────────────────────────────
  const telnyxKey = process.env.TELNYX_API_KEY;
  const telnyxProfile = process.env.TELNYX_CONNECTION_ID;
  const telnyxFrom = process.env.TELNYX_FROM_NUMBER;
  if (!input.forceSimulation && telnyxKey && telnyxProfile && telnyxFrom) {
    try {
      const res = await fetch('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${telnyxKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: telnyxFrom,
          to: input.to,
          text: input.body,
          messaging_profile_id: telnyxProfile,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        return {
          status: 'sent',
          providerName: 'telnyx',
          providerMessageId: data.data?.id,
          providerHttpStatus: 200,
          simulated: false,
        };
      }
      return {
        status: 'failed',
        providerName: 'telnyx',
        providerHttpStatus: res.status,
        simulated: false,
        error: `Telnyx HTTP ${res.status}`,
      };
    } catch (e: any) {
      return {
        status: 'failed',
        providerName: 'telnyx',
        providerHttpStatus: 0,
        simulated: false,
        error: e?.message?.slice(0, 200) || 'Telnyx fetch failed',
      };
    }
  }

  // ─── 4. sms.domovina.ai ───────────────────────────────────────────────────
  const domovinaUrl = process.env.DOMOVINA_SMS_API_URL;
  const domovinaKey = process.env.DOMOVINA_SMS_API_KEY;
  if (!input.forceSimulation && domovinaUrl && domovinaKey) {
    try {
      const res = await fetch(`${domovinaUrl.replace(/\/$/, '')}/api/sms/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${domovinaKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to: input.to, message: input.body }),
      });
      if (res.ok) {
        const data: any = await res.json();
        return {
          status: 'sent',
          providerName: 'domovina',
          providerMessageId: data.id || data.messageId,
          providerHttpStatus: 200,
          simulated: false,
        };
      }
      return {
        status: 'failed',
        providerName: 'domovina',
        providerHttpStatus: res.status,
        simulated: false,
        error: `Domovina HTTP ${res.status}`,
      };
    } catch (e: any) {
      return {
        status: 'failed',
        providerName: 'domovina',
        providerHttpStatus: 0,
        simulated: false,
        error: e?.message?.slice(0, 200) || 'Domovina fetch failed',
      };
    }
  }

  // ─── Fallback: simulation (no provider configured) ───────────────────────
  return {
    status: 'simulation',
    providerName: 'simulation',
    providerMessageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    providerHttpStatus: 0,
    simulated: true,
    error: 'No SMS provider configured. Set TWILIO_*, HTTPSMS_*, TELNYX_*, or DOMOVINA_SMS_* env vars to enable real delivery.',
  };
}

/**
 * Get a description of the SMS provider chain status (for admin UI + audit).
 */
export function getSmsProviderStatus(): Array<{ name: string; configured: boolean; fromNumber?: string }> {
  return [
    {
      name: 'twilio',
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    },
    {
      name: 'httpsms',
      configured: !!(process.env.HTTPSMS_API_KEY && process.env.HTTPSMS_FROM_NUMBER),
      fromNumber: process.env.HTTPSMS_FROM_NUMBER,
    },
    {
      name: 'telnyx',
      configured: !!(process.env.TELNYX_API_KEY && process.env.TELNYX_CONNECTION_ID && process.env.TELNYX_FROM_NUMBER),
      fromNumber: process.env.TELNYX_FROM_NUMBER,
    },
    {
      name: 'domovina',
      configured: !!(process.env.DOMOVINA_SMS_API_URL && process.env.DOMOVINA_SMS_API_KEY),
    },
  ];
}
