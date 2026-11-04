import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const [tickets, messages, smsMessages, socialAccounts] = await Promise.all([
      db.ticket.findMany({ where: { companyId: payload.companyId, status: { in: ['open', 'in_progress'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.message.findMany({ where: { OR: [{ senderId: payload.userId }, { recipientId: payload.userId }] }, orderBy: { createdAt: 'desc' }, take: 20, include: { sender: { select: { id: true, name: true } } } }),
      db.smsMessage.findMany({ where: { companyId: payload.companyId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.socialAccount.findMany({ where: { companyId: payload.companyId, status: 'active' } }),
    ]);
    const inbox: any[] = [];
    for (const t of tickets) inbox.push({ id: t.id, type: 'ticket', platform: 'crm', subject: t.subject, snippet: t.description?.slice(0, 100) || '', priority: t.priority, status: t.status, unread: false, createdAt: t.createdAt.toISOString() });
    for (const m of messages) inbox.push({ id: m.id, type: 'message', platform: 'internal', subject: m.sender?.name || 'Unknown', snippet: m.content.slice(0, 100), status: m.isRead ? 'read' : 'unread', unread: !m.isRead, createdAt: m.createdAt.toISOString() });
    for (const s of smsMessages) inbox.push({ id: s.id, type: 'sms', platform: 'sms', subject: s.to, snippet: s.body.slice(0, 100), status: s.status, unread: s.status === 'queued', createdAt: s.createdAt.toISOString() });
    inbox.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ data: { inbox, stats: { total: inbox.length, unread: inbox.filter(i => i.unread).length, platforms: socialAccounts.map(a => ({ platform: a.platform, name: a.accountName, status: a.status })) } } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
