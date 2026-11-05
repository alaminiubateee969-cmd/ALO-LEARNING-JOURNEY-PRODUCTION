import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { sendSmsViaProvider } from '@/lib/sms-provider-chain';

// POST /api/sms/send — queue an SMS for sending via the configured provider chain
// Body: { to: "+15551234567", body: "Hello!", leadId?: string, contactId?: string }
//
// Real delivery: when TWILIO_* / HTTPSMS_* / TELNYX_* / DOMOVINA_SMS_* env vars
// are configured, the chain calls the real provider API synchronously and
// updates the SmsMessage row with the real provider message id. When no
// provider is configured, the row is persisted as 'simulation' so the UI
// can label it accordingly (no false claim of real delivery).
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const to = String(body.to || '').trim();
    const text = String(body.body || '').trim();
    if (!to || !text) {
      return NextResponse.json({ error: 'to and body are required' }, { status: 400 });
    }
    if (text.length > 1600) {
      return NextResponse.json({ error: 'SMS body too long (max 1600 chars)' }, { status: 400 });
    }

    // Create the SMS row with status=queued
    const sms = await db.smsMessage.create({
      data: {
        to,
        from: null,
        body: text,
        status: 'queued',
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        companyId: payload.companyId,
        sentBy: payload.userId,
      },
    });

    // Dispatch via real provider chain (or simulation when none configured)
    const result = await sendSmsViaProvider({
      to,
      body: text,
      companyId: payload.companyId,
      sentBy: payload.userId,
      leadId: body.leadId,
      contactId: body.contactId,
    });

    // Update row with the actual outcome
    await db.smsMessage.update({
      where: { id: sms.id },
      data: {
        status: result.status === 'simulation' ? 'sent' : result.status,
        providerMessageId: result.providerMessageId
          ? `${result.providerName}_${result.providerMessageId}`
          : `sim_${sms.id}_${Date.now()}`,
      },
    });

    // Fire the event for notifications + audit log
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: result.simulated ? 'sms.simulated' : 'sms.sent',
      title: result.simulated ? 'SMS simulated (no provider)' : `SMS sent via ${result.providerName}`,
      description: `SMS to ${to}: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
      resourceType: 'sms',
      resourceId: sms.id,
      link: body.leadId ? '/crm' : undefined,
      metadata: { to, body: text.slice(0, 100), provider: result.providerName, simulated: result.simulated },
    });

    return NextResponse.json({
      data: {
        id: sms.id,
        to: sms.to,
        body: sms.body,
        status: result.status,
        provider: result.providerName,
        providerMessageId: result.providerMessageId,
        simulated: result.simulated,
        createdAt: sms.createdAt.toISOString(),
        ...(result.error ? { warning: result.error } : {}),
      },
    }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/sms/send]', err);
    return NextResponse.json({ error: 'Failed to send SMS', message: err?.message?.slice(0, 200) }, { status: 500 });
  }
}
