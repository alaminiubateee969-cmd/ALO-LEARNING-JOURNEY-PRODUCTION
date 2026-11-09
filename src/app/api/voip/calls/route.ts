import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/voip/calls — list VoIP call history
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all VoIP call records (stored as SmsMessage with providerMessageId starting with 'voip_')
    const calls = await db.smsMessage.findMany({
      where: {
        companyId: payload.companyId,
        providerMessageId: { startsWith: 'voip_' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      data: calls.map((c) => ({
        id: c.id,
        to: c.to,
        from: c.from,
        status: c.status,
        body: c.body,
        leadId: c.leadId,
        contactId: c.contactId,
        caller: c.sender,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[GET /api/voip/calls]', err);
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 });
  }
}
