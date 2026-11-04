import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
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
      const leads = await db.lead.findMany({ where: { id: { in: body.leadIds }, companyId: payload.companyId, phone: { not: null } }, select: { id: true, name: true, phone: true } });
      recipients = leads.map(l => ({ phone: l.phone!, leadId: l.id, name: l.name }));
    } else if (body.filter) {
      const where: any = { companyId: payload.companyId, phone: { not: null } };
      if (body.filter.source) where.source = body.filter.source;
      if (body.filter.status) where.status = body.filter.status;
      const leads = await db.lead.findMany({ where, select: { id: true, name: true, phone: true } });
      recipients = leads.map(l => ({ phone: l.phone!, leadId: l.id, name: l.name }));
    }
    if (recipients.length === 0) return NextResponse.json({ error: 'No recipients' }, { status: 400 });
    recipients = recipients.slice(0, 100);
    let sent = 0, failed = 0;
    for (const r of recipients) {
      try { await db.smsMessage.create({ data: { to: r.phone, from: null, body: message, status: 'sent', providerMessageId: `broadcast_${Date.now()}_${sent}`, leadId: r.leadId, companyId: payload.companyId, sentBy: payload.userId } }); sent++; await new Promise(resolve => setTimeout(resolve, 100)); } catch { failed++; }
    }
    await emitEvent({ companyId: payload.companyId, userId: payload.userId, type: 'sms.broadcast_sent', title: `Broadcast to ${sent}`, description: message.slice(0, 60), resourceType: 'sms', metadata: { sent, failed } });
    return NextResponse.json({ data: { sent, failed, total: recipients.length } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
