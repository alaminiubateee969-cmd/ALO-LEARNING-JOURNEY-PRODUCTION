import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// POST /api/messages/[id]/read — mark inbound unread messages from user [id] as read
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id: otherUserId } = await params;
    const result = await db.message.updateMany({
      where: {
        senderId: otherUserId,
        recipientId: payload.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error('[POST /api/messages/[id]/read]', err);
    return NextResponse.json({ error: 'Failed to mark messages as read' }, { status: 500 });
  }
}
