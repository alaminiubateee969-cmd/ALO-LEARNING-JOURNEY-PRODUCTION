import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/voip/call — initiate a VoIP call to a lead/contact
// Inspired by linphone/0perationPrivacy VoIP patterns
// Body: { to: string, leadId?: string, contactId?: string }
//
// In production, this would connect to a VoIP provider (Twilio, Linphone, etc.)
// Here we create a call record + emit an event so webhooks can trigger the actual call.
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
    if (!to) return NextResponse.json({ error: 'Phone number (to) is required' }, { status: 400 });

    // Create a call record (reuse SmsMessage table with type='voip_call')
    // In production, this would call Twilio/Linphone/etc. to initiate the call
    const call = await db.smsMessage.create({
      data: {
        to,
        from: null,
        body: `VoIP call initiated to ${to}`,
        status: 'queued',
        providerMessageId: `voip_${Date.now()}`,
        leadId: body.leadId || null,
        contactId: body.contactId || null,
        companyId: payload.companyId,
        sentBy: payload.userId,
      },
    });

    // Emit event — webhook can pick this up and trigger the actual VoIP call
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'voip.call_initiated',
      title: 'VoIP call initiated',
      description: `Call to ${to}${body.leadId ? ` (lead: ${body.leadId})` : ''}`,
      resourceType: 'voip_call',
      resourceId: call.id,
      link: body.leadId ? '/crm' : undefined,
      metadata: { to, leadId: body.leadId, contactId: body.contactId },
    });

    // Simulate call connection after 2 seconds
    setTimeout(async () => {
      try {
        await db.smsMessage.update({
          where: { id: call.id },
          data: { status: 'sent', body: `VoIP call connected to ${to}` },
        });
        await emitEvent({
          companyId: payload.companyId,
          userId: payload.userId,
          type: 'voip.call_connected',
          title: 'VoIP call connected',
          description: `Call to ${to} is now connected`,
          resourceType: 'voip_call',
          resourceId: call.id,
        });
      } catch (err) {
        console.error('[voip call] failed to update:', err);
      }
    }, 2000);

    return NextResponse.json({
      data: {
        callId: call.id,
        to,
        status: 'connecting',
        message: 'VoIP call is being initiated. Configure a webhook with type=voip.call_initiated to connect to a real VoIP provider (Twilio, Linphone, etc.)',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/voip/call]', err);
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}
