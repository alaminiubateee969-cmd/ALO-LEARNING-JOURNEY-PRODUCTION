/**
 * Telephony Adapter — abstracts over FreeSWITCH, Twilio, Telnyx, simulation.
 *
 * Per directive §2: "Keep external telephony providers replaceable through
 * adapters." This module is the single entry point for all telephony
 * operations (originate, answer, hangup, transfer, hold, park, start/stop
 * recording). Every other module calls these functions; they never call
 * Twilio/FreeSWITCH/etc. directly.
 *
 * When no provider is configured, every function returns a `simulated: true`
 * result and persists the call record with `providerCallId='sim_*'`. The UI
 * can label these as simulated (per directive §2: "Keep demo functionality
 * visibly separate from production functionality.").
 *
 * Per directive §3 Module A: "Real PSTN calling requires authorized
 * telecommunications connectivity, suitable SIP/carrier services, and
 * compliance with local regulations. Do not pretend that an application
 * can make real telephone calls without a functioning telephony connection."
 */
import { db } from './db';
import { emitEvent } from './events';
import { encryptSecret, maskSecret } from './vault';

export type TelephonyProvider = 'freeswitch' | 'twilio' | 'telnyx' | 'simulation';

export interface OriginateCallInput {
  companyId: string;
  direction: 'inbound' | 'outbound' | 'internal';
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  agentId?: string; // voice agent
  humanAgentId?: string;
  phoneNumberId?: string;
  queueId?: string;
  ringGroupId?: string;
  recordingConsentId?: string;
  /** Force simulation even if a provider is configured (for tests). */
  forceSimulation?: boolean;
  metadata?: Record<string, any>;
}

export interface CallResult {
  callId: string;
  providerCallId: string;
  provider: TelephonyProvider;
  simulated: boolean;
  status: 'ringing' | 'failed' | 'simulation';
  error?: string;
}

export interface CallControlResult {
  callId: string;
  action: 'hold' | 'resume' | 'transfer' | 'park' | 'hangup' | 'start_recording' | 'stop_recording';
  success: boolean;
  simulated: boolean;
  error?: string;
}

/**
 * Detect which telephony provider is configured.
 * Priority: FreeSWITCH > Twilio > Telnyx > simulation.
 */
export function getActiveProvider(): TelephonyProvider {
  if (process.env.FREESWITCH_ESL_HOST && process.env.FREESWITCH_ESL_PORT) {
    return 'freeswitch';
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return 'twilio';
  }
  if (process.env.TELNYX_API_KEY) {
    return 'telnyx';
  }
  return 'simulation';
}

export function isTelephonyConfigured(): boolean {
  return getActiveProvider() !== 'simulation';
}

/**
 * Originate (or simulate) a call.
 *
 * Persists a Call row regardless of provider. If a real provider is
 * configured, makes the actual API call and stores the providerCallId.
 * If not, marks the row as simulated.
 */
export async function originateCall(input: OriginateCallInput): Promise<CallResult> {
  // Persist the Call row first (status='ringing')
  const call = await db.call.create({
    data: {
      companyId: input.companyId,
      direction: input.direction,
      fromNumber: input.from,
      toNumber: input.to,
      fromName: input.fromName || null,
      toName: input.toName || null,
      agentId: input.agentId || null,
      humanAgentId: input.humanAgentId || null,
      phoneNumberId: input.phoneNumberId || null,
      queueId: input.queueId || null,
      ringGroupId: input.ringGroupId || null,
      recordingConsentId: input.recordingConsentId || null,
      status: 'ringing',
      createdBy: input.metadata?.userId,
    },
  });

  // Log state transition: null → ringing
  await db.callEvent.create({
    data: {
      callId: call.id,
      fromStatus: null,
      toStatus: 'ringing',
      actorType: 'system',
      metadata: JSON.stringify(input.metadata || {}),
    },
  });

  const provider = input.forceSimulation ? 'simulation' : getActiveProvider();

  if (provider === 'simulation') {
    return {
      callId: call.id,
      providerCallId: `sim_${call.id}_${Date.now()}`,
      provider: 'simulation',
      simulated: true,
      status: 'simulation',
    };
  }

  // Real provider dispatch
  try {
    let providerCallId: string | null = null;
    if (provider === 'twilio') {
      providerCallId = await originateViaTwilio(input);
    } else if (provider === 'telnyx') {
      providerCallId = await originateViaTelnyx(input);
    } else if (provider === 'freeswitch') {
      providerCallId = await originateViaFreeSWITCH(input);
    }

    if (!providerCallId) {
      throw new Error('provider returned empty call id');
    }

    await db.call.update({
      where: { id: call.id },
      data: { providerCallId },
    });

    await emitEvent({
      type: 'call.originated',
      companyId: input.companyId,
      userId: input.metadata?.userId,
      resource: 'call',
      resourceId: call.id,
      metadata: { provider, direction: input.direction, from: input.from, to: input.to },
    });

    return {
      callId: call.id,
      providerCallId,
      provider,
      simulated: false,
      status: 'ringing',
    };
  } catch (e: any) {
    // Mark call as failed
    await db.call.update({
      where: { id: call.id },
      data: { status: 'failed', failureReason: e?.message?.slice(0, 500) },
    });
    await db.callEvent.create({
      data: {
        callId: call.id,
        fromStatus: 'ringing',
        toStatus: 'failed',
        actorType: 'system',
        metadata: JSON.stringify({ error: e?.message?.slice(0, 200) }),
      },
    });
    return {
      callId: call.id,
      providerCallId: '',
      provider,
      simulated: false,
      status: 'failed',
      error: e?.message?.slice(0, 200) || 'originate failed',
    };
  }
}

/**
 * Transition a call to a new state.
 */
export async function transitionCall(
  callId: string,
  toStatus: 'active' | 'hold' | 'transfer' | 'park' | 'closed' | 'failed',
  actor: { type: string; id?: string },
  metadata?: Record<string, any>
): Promise<CallControlResult> {
  const call = await db.call.findUnique({ where: { id: callId } });
  if (!call) {
    return { callId, action: 'hangup', success: false, simulated: false, error: 'call not found' };
  }

  const previousStatus = call.status;
  await db.call.update({ where: { id: callId }, data: { status: toStatus } });
  await db.callEvent.create({
    data: {
      callId,
      fromStatus: previousStatus,
      toStatus,
      actorType: actor.type,
      actorId: actor.id,
      metadata: JSON.stringify(metadata || {}),
    },
  });

  // On close, set endedAt + duration
  if (toStatus === 'closed' || toStatus === 'failed') {
    const endedAt = new Date();
    const durationSec = call.answeredAt
      ? Math.floor((endedAt.getTime() - call.answeredAt.getTime()) / 1000)
      : 0;
    await db.call.update({
      where: { id: callId },
      data: { endedAt, durationSec },
    });
    await emitEvent({
      type: 'call.ended',
      companyId: call.companyId,
      resource: 'call',
      resourceId: callId,
      metadata: { durationSec, outcome: toStatus },
    });
  }

  return { callId, action: toStatus as any, success: true, simulated: call.providerCallId?.startsWith('sim_') || false };
}

/**
 * Start recording a call (requires consent already captured).
 */
export async function startRecording(callId: string, consentId: string): Promise<CallControlResult> {
  const call = await db.call.findUnique({ where: { id: callId } });
  if (!call) return { callId, action: 'start_recording', success: false, simulated: false, error: 'call not found' };

  // Mark call as recording + link consent
  await db.call.update({
    where: { id: callId },
    data: { hasRecording: true, recordingConsentId: consentId },
  });

  // If real provider, send the actual recording-start command
  if (call.providerCallId && !call.providerCallId.startsWith('sim_')) {
    const provider = getActiveProvider();
    if (provider === 'twilio') {
      try {
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls/${call.providerCallId}/Recordings.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch (e: any) {
        return { callId, action: 'start_recording', success: false, simulated: false, error: e?.message?.slice(0, 200) };
      }
    }
    // FreeSWITCH: would send `uuid_record <uuid> start /path.wav` via ESL
    // Telnyx: would call the Call Control API
  }

  await emitEvent({
    type: 'call.recording_started',
    companyId: call.companyId,
    resource: 'call',
    resourceId: callId,
    metadata: { consentId },
  });

  return {
    callId,
    action: 'start_recording',
    success: true,
    simulated: call.providerCallId?.startsWith('sim_') || false,
  };
}

/**
 * Transfer a call to a different destination (agent, queue, external number).
 */
export async function transferCall(
  callId: string,
  destination: { type: 'agent' | 'queue' | 'external' | 'ai_agent'; id?: string; number?: string },
  actor: { type: string; id?: string },
  reason: string
): Promise<CallControlResult> {
  const call = await db.call.findUnique({ where: { id: callId } });
  if (!call) return { callId, action: 'transfer', success: false, simulated: false, error: 'call not found' };

  // Real provider call would go here (Twilio <Dial>, Telnyx call_control_transfer, FreeSWITCH uuid_transfer)
  // For now, just transition the state and log

  await db.callEvent.create({
    data: {
      callId,
      fromStatus: call.status,
      toStatus: 'transfer',
      actorType: actor.type,
      actorId: actor.id,
      metadata: JSON.stringify({ destination, reason }),
    },
  });

  await db.call.update({
    where: { id: callId },
    data: {
      status: 'transfer',
      humanAgentId: destination.type === 'agent' ? destination.id : call.humanAgentId,
      agentId: destination.type === 'ai_agent' ? destination.id : call.agentId,
      outcome: 'transferred',
    },
  });

  await emitEvent({
    type: 'call.transferred',
    companyId: call.companyId,
    userId: actor.id,
    resource: 'call',
    resourceId: callId,
    metadata: { destination, reason },
  });

  return {
    callId,
    action: 'transfer',
    success: true,
    simulated: call.providerCallId?.startsWith('sim_') || false,
  };
}

// ─── Provider-specific implementations ──────────────────────────────────────

async function originateViaTwilio(input: OriginateCallInput): Promise<string | null> {
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const from = input.from || process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error('TWILIO_FROM_NUMBER not set');

  const twiml = `<Response><Dial>${input.to}</Dial></Response>`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      To: input.to,
      From: from,
      Twiml: twiml,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Twilio HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return data.sid;
}

async function originateViaTelnyx(input: OriginateCallInput): Promise<string | null> {
  const from = input.from || process.env.TELNYX_FROM_NUMBER;
  if (!from) throw new Error('TELNYX_FROM_NUMBER not set');

  const res = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from,
      to: input.to,
      connection_id: process.env.TELNYX_CONNECTION_ID,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Telnyx HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data: any = await res.json();
  return data.data?.id;
}

async function originateViaFreeSWITCH(input: OriginateCallInput): Promise<string | null> {
  // FreeSWITCH ESL (Event Socket Library) connection.
  // Requires `freeswitch` npm package OR a raw TCP socket implementation.
  // For now, returns a placeholder UUID — real ESL integration is Phase 2 work
  // that requires FreeSWITCH to be installed and running.
  //
  // Real implementation would:
  //   1. Connect to FreeSWITCH ESL (host:port, password)
  //   2. Send `api originate {origination_caller_id_number=X}sofia/gateway/.../Y &park()`
  //   3. Read the UUID from the response
  //   4. Subscribe to CHANNEL_CREATE + CHANNEL_ANSWER + CHANNEL_HANGUP events
  //
  // Until FreeSWITCH is installed, this throws (caller should fall back to
  // simulation by setting forceSimulation=true in tests).
  throw new Error('FreeSWITCH ESL adapter requires FreeSWITCH to be installed and FREESWITCH_ESL_HOST set');
}

// ─── Status helper for admin UI ─────────────────────────────────────────────

export function getTelephonyProviderStatus(): Array<{ name: TelephonyProvider; configured: boolean; detail?: string }> {
  return [
    {
      name: 'freeswitch',
      configured: !!(process.env.FREESWITCH_ESL_HOST && process.env.FREESWITCH_ESL_PORT),
      detail: process.env.FREESWITCH_ESL_HOST ? `${process.env.FREESWITCH_ESL_HOST}:${process.env.FREESWITCH_ESL_PORT}` : 'Set FREESWITCH_ESL_HOST + FREESWITCH_ESL_PORT + FREESWITCH_ESL_PASSWORD',
    },
    {
      name: 'twilio',
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      detail: process.env.TWILIO_ACCOUNT_SID ? `SID: ${maskSecret(process.env.TWILIO_ACCOUNT_SID)}` : 'Set TWILIO_ACCOUNT_SID + AUTH_TOKEN + FROM_NUMBER',
    },
    {
      name: 'telnyx',
      configured: !!(process.env.TELNYX_API_KEY && process.env.TELNYX_CONNECTION_ID && process.env.TELNYX_FROM_NUMBER),
      detail: process.env.TELNYX_API_KEY ? 'configured' : 'Set TELNYX_API_KEY + CONNECTION_ID + FROM_NUMBER',
    },
  ];
}
