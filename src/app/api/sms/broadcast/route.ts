import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import { sendSmsViaProvider } from '@/lib/sms-provider-chain';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const message = String(body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
    let recipients: any[] = [];
    if (Array.isArray(body.leadIds) && body.leadIds.length > 0) {
      const leads = await db.mosLead.findMany({ where: { id: { in: body.leadIds }, companyId: payload.companyId, phone: { not: null } }, select: { id: true, name: true, phone: true } });
      recipients = leads.map(l => ({ phone: l.phone!, leadId: l.id, name: l.name }));
    } else if (body.filter) {
      const where: any = { companyId: payload.companyId, phone: { not: null } };
      if (body.filter.source) where.source = body.filter.source;
      if (body.filter.status) where.status = body.filter.status;
      const leads = await db.mosLead.findMany({ where, select: { id: true, name: true, phone: true } });
      recipients = leads.map(l => ({ phone: l.phone!, leadId: l.id, name: l.name }));
    }
    if (recipients.length === 0) return NextResponse.json({ error: 'No recipients' }, { status: 400 });
    recipients = recipients.slice(0, 100);

    let sent = 0, failed = 0, simulated = 0;
    const providerUsed: string[] = [];
    for (const r of recipients) {
      try {
        // Persist queued row first
        const sms = await db.smsMessage.create({
          data: {
            to: r.phone,
            from: null,
            body: message,
            status: 'queued',
            leadId: r.leadId,
            companyId: payload.companyId,
            sentBy: payload.userId,
          },
        });

        // Dispatch via real provider chain
        const result = await sendSmsViaProvider({
          to: r.phone,
          body: message,
          companyId: payload.companyId,
          sentBy: payload.userId,
          leadId: r.leadId,
        });

        // Update row with outcome
        await db.smsMessage.update({
          where: { id: sms.id },
          data: {
            status: result.status === 'simulation' ? 'sent' : result.status,
            providerMessageId: result.providerMessageId
              ? `${result.providerName}_${result.providerMessageId}`
              : `broadcast_${Date.now()}_${sent}`,
          },
        });

        if (result.simulated) simulated++;
        if (result.status === 'failed') failed++;
        else sent++;
        if (!providerUsed.includes(result.providerName)) providerUsed.push(result.providerName);
        await new Promise(resolve => setTimeout(resolve, 100)); // rate-limit
      } catch { failed++; }
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: simulated > 0 && sent === 0 ? 'sms.broadcast_simulated' : 'sms.broadcast_sent',
      title: `Broadcast to ${sent} (${simulated} simulated)`,
      description: message.slice(0, 60),
      resourceType: 'sms',
      metadata: { sent, failed, simulated, total: recipients.length, providers: providerUsed },
    });

    return NextResponse.json({
      data: {
        sent,
        failed,
        simulated,
        total: recipients.length,
        providers: providerUsed,
      },
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed', message: e?.message?.slice(0, 200) }, { status: 500 });
  }
}
